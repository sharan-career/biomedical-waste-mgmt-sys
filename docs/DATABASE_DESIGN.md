# Database Design — ER Model

Phase 0 deliverable. PostgreSQL + Prisma. Every entity includes `id` (UUID), `createdAt`,
`updatedAt`, `createdBy`, `updatedBy` per the master spec's audit-field requirement — omitted below
per-entity for brevity, assume present on all tables except pure join/lookup tables where noted.

Money fields are `Decimal` (Prisma `Decimal` / Postgres `NUMERIC`), never float. Soft deletes
(`deletedAt` nullable) on Customer, Contract, RateCard, User — never on Invoice/Payment (financial
records are never deleted, only cancelled/reversed via status + new records).

---

## 1. Entity List

**Identity & Access**
`User`, `Role`, `UserRole` (join), `RefreshToken`, `AuditLog`

**Geography / Org structure** (new — from real data)
`Taluka`, `Route`

**Customer domain**
`Customer`, `CustomerContact`

**Contract & Pricing**
`Contract`, `RateCard`, `RateCardComponent`

**Waste data** (new — from real data, supports usage-based billing)
`WasteCategory`, `MonthlyWasteRecord`, `MonthlyWasteRecordLine`

**Billing**
`Invoice`, `InvoiceLineItem`, `CreditNote`, `CreditNoteLineItem`

**Payments**
`Payment`, `PaymentAllocation`

**Collections**
`FollowUp`, `ReminderRule`, `ReminderLog`

---

## 2. Identity & Access

```
User
  id, email (unique), passwordHash, fullName, phone, status (ACTIVE|INACTIVE),
  lastLoginAt

Role
  id, name (SUPER_ADMIN|ACCOUNTS_MANAGER|COLLECTION_EXECUTIVE|MANAGEMENT), description

UserRole (join)
  userId → User, roleId → Role
  -- supports multiple roles per user (Open Question in USER_ROLES.md); MVP can still
  -- enforce "exactly one active role" at the application layer if the business says so

RefreshToken
  id, userId → User, tokenHash, expiresAt, revokedAt (nullable), createdByIp

AuditLog
  id, userId → User (nullable — system actions), action (enum: CUSTOMER_CREATED,
  INVOICE_APPROVED, PAYMENT_RECORDED, ...), entityType, entityId,
  previousValue (JSONB, nullable), newValue (JSONB), createdAt
  -- append-only, no updatedAt/updatedBy — an audit log is never edited
```

## 3. Geography / Org Structure (new)

```
Taluka
  id, name (Kalaburagi | Jewargi | Sedam | Chittapur | ... extensible), districtName

Route
  id, talukaId → Taluka, routeNumber, name (nullable), assignedExecutiveId → User (nullable)
```

Rationale: the real MOU/monthly-report data organizes every customer by Taluka and Route today.
Modeling these as first-class lookup tables (not free-text on Customer) enables the
route/territory-based Collection Executive assignment flagged as an open question in
`USER_ROLES.md`, and matches existing reporting structure so a "Taluka-wise abstract" report (like
the real `ABSTRACT` sheet) is a native query, not a re-derivation from address text.

## 4. Customer Domain

```
Customer
  id, customerCode (unique, human-readable), organizationName,
  customerType (PRIVATE | GOVERNMENT),               -- from real data: govt hospitals distinct
  facilityType (BEDDED_HOSPITAL | CLINIC | DENTAL_CLINIC | LAB | OTHER),
  bedCount (nullable — only meaningful for BEDDED_HOSPITAL),
  talukaId → Taluka, routeId → Route (nullable),
  address, city, state, pincode,
  gstNumber (nullable), panNumber (nullable),
  paymentTermsDays (int, e.g. 30),
  status (ACTIVE | INACTIVE),
  deletedAt (nullable, soft delete)

CustomerContact
  id, customerId → Customer,
  contactType (PRIMARY | ACCOUNTS | OTHER),
  name, phone, email
  -- models "Dr Name / primary contact" and "accounts contact" as rows, not two ad hoc
  -- columns on Customer, so a customer can have more than one accounts contact over time
```

## 5. Contract & Pricing

```
Contract
  id, contractNumber (unique), customerId → Customer,
  startDate, endDate (nullable — open-ended),
  billingFrequency (MONTHLY | QUARTERLY | HALF_YEARLY | YEARLY | CUSTOM),
  billingDayOfPeriod (int, nullable — e.g. bill on the 5th of each period),
  paymentTermsDays (int, overrides Customer default if set),
  status (DRAFT | ACTIVE | EXPIRED | TERMINATED),
  activeRateCardId → RateCard,
  notes

RateCard
  id, name, customerId → Customer (nullable — null means a reusable template rate card),
  effectiveFrom, effectiveTo (nullable),
  status (DRAFT | ACTIVE | SUPERSEDED)
  -- a Contract points to one active RateCard at a time; rate changes create a NEW
  -- RateCard version (effectiveFrom/To) rather than mutating history, so past invoices
  -- always reflect the rate that was actually in force when they were generated

RateCardComponent
  id, rateCardId → RateCard,
  componentType (FIXED_FEE | PER_KG | PER_PICKUP | PER_BED | SERVICE_CHARGE | DISCOUNT),
  wasteCategoryId → WasteCategory (nullable — only for PER_KG components),
  unitAmount (Decimal), taxable (boolean)
  -- e.g. one RateCard can have: FIXED_FEE 2000, PER_KG(Yellow) 15, PER_KG(Red) 20,
  -- PER_BED 50, DISCOUNT -500 — invoice generation sums applicable components
```

## 6. Waste Data (new — supports usage-based billing)

```
WasteCategory
  id, name (YELLOW | RED | BLUE | WHITE | GENERAL), description
  -- seeded lookup table, matches BMW Rules 2016 color coding already used in real reports

MonthlyWasteRecord
  id, customerId → Customer, periodMonth (date, first-of-month), source (MANUAL_ENTRY | CSV_IMPORT | CODELAND_API),
  enteredBy → User, enteredAt
  -- one record per customer per billing period

MonthlyWasteRecordLine
  id, monthlyWasteRecordId → MonthlyWasteRecord, wasteCategoryId → WasteCategory,
  quantityKg (Decimal)
  -- mirrors the real report's Yellow/Red/Blue/White/General columns as rows, not fixed
  -- columns, so adding a waste category later doesn't require a schema migration
```

## 7. Billing

```
Invoice
  id, invoiceNumber (unique), customerId → Customer, contractId → Contract,
  invoiceDate, billingPeriodStart, billingPeriodEnd, dueDate,
  subtotal, discountAmount, taxAmount, totalAmount, paidAmount, outstandingAmount (all Decimal),
  status (DRAFT | APPROVED | SENT | PARTIALLY_PAID | PAID | CANCELLED),
  -- OVERDUE is derived (status IN (SENT, PARTIALLY_PAID) AND dueDate < today), never stored
  cancelledReason (nullable), approvedBy → User (nullable), approvedAt (nullable)

InvoiceLineItem
  id, invoiceId → Invoice,
  description, lineType (FIXED_FEE | USAGE_CHARGE | TRANSPORTATION | SERVICE_CHARGE | DISCOUNT | TAX),
  wasteCategoryId → WasteCategory (nullable), quantityKg (nullable),
  unitAmount, lineAmount (Decimal)
  -- generated from RateCardComponent + MonthlyWasteRecordLine at billing-run time;
  -- kept as its own immutable record so a later rate-card change never alters a past invoice

CreditNote
  id, invoiceId → Invoice, customerId → Customer,
  reason, amount (Decimal), status (DRAFT | APPROVED | APPLIED),
  approvedBy → User (nullable)

CreditNoteLineItem
  id, creditNoteId → CreditNote, description, amount (Decimal)
```

## 8. Payments

```
Payment
  id, customerId → Customer,
  amount (Decimal), paymentMode (BANK_TRANSFER | UPI | CHEQUE | CASH | OTHER),
  paymentDate, referenceNumber (nullable), bankDetails (nullable), notes (nullable),
  status (RECORDED | REVERSED),
  reversalOfPaymentId → Payment (nullable, self-reference — set when this Payment record
                                  IS a reversal of an earlier one)

PaymentAllocation
  id, paymentId → Payment, invoiceId → Invoice, allocatedAmount (Decimal)
  -- a Payment can have N allocations (split across invoices); an Invoice can have N
  -- allocations from different payments over time. Invoice.paidAmount is the sum of
  -- non-reversed allocations against it — recomputed, not hand-maintained, whenever an
  -- allocation is created or its payment is reversed
```

## 9. Collections

```
FollowUp
  id, customerId → Customer, invoiceId → Invoice (nullable — can be customer-level),
  assignedToId → User, followUpDate, followUpType (PHONE_CALL | WHATSAPP | EMAIL | VISIT | OTHER),
  contactPerson, discussionNotes, customerResponse (nullable),
  promiseAmount (nullable, Decimal), promisePaymentDate (nullable),
  nextFollowUpDate (nullable),
  status (OPEN | FOLLOW_UP_REQUIRED | PROMISE_TO_PAY | DISPUTED | ESCALATED | CLOSED)
  -- each state transition is a NEW row (see BUSINESS_WORKFLOW.md) so history is a simple
  -- "all FollowUp rows for this customer/invoice, ordered by followUpDate" query

ReminderRule
  id, name, triggerType (DAYS_BEFORE_DUE | ON_DUE_DATE | DAYS_AFTER_DUE),
  triggerOffsetDays (int), channel (WHATSAPP | EMAIL | SMS), messageTemplate,
  active (boolean)
  -- configurable per master spec ("do not hardcode reminder schedules")

ReminderLog
  id, ruleId → ReminderRule, customerId → Customer, invoiceId → Invoice,
  channel, message, sentAt, deliveryStatus (SENT | FAILED | DELIVERED | READ — provider-dependent),
  responseText (nullable), responseAt (nullable)
  -- unique constraint on (ruleId, invoiceId) to prevent duplicate firing of the same rule
  -- against the same invoice, per BUSINESS_WORKFLOW.md's duplicate-suppression requirement
```

## 10. Key Relationships Diagram (textual)

```
Taluka 1───N Route 1───N Customer N───1 Taluka (denormalized FK for direct filtering)
Customer 1───N CustomerContact
Customer 1───N Contract 1───1 RateCard 1───N RateCardComponent ──── WasteCategory
Customer 1───N MonthlyWasteRecord 1───N MonthlyWasteRecordLine ──── WasteCategory
Contract 1───N Invoice 1───N InvoiceLineItem
Invoice 1───N CreditNote 1───N CreditNoteLineItem
Invoice N───N Payment  (via PaymentAllocation)
Customer 1───N FollowUp N───1 User (assignedTo)
Invoice 1───N FollowUp (nullable link)
ReminderRule 1───N ReminderLog N───1 Invoice
User 1───N UserRole N───1 Role
```

## 11. Constraints & Indexing Notes

- `Invoice.outstandingAmount = totalAmount - paidAmount`, recomputed on every payment
  allocation/reversal inside a DB transaction — never independently settable via API.
- Composite index on `Invoice(customerId, status, dueDate)` — the exact shape "Follow-ups Today"
  and aging reports query.
- Composite index on `FollowUp(assignedToId, status, nextFollowUpDate)` — the Collection
  Executive's primary screen.
- Composite index on `MonthlyWasteRecord(customerId, periodMonth)` unique — one record per customer
  per period, prevents duplicate entry for the same month.
- `PaymentAllocation` sum per invoice must never exceed `Invoice.totalAmount` for non-reversed
  allocations under normal flow — enforced at the application/transaction layer (see
  `EDGE_CASES.md` for the deliberate overpayment exception path).
- All monetary columns: `NUMERIC(14,2)` (or higher precision if paise-level rounding rules require
  it — confirm with Accounts).

## 12. Open Questions Affecting This Design

1. Confirmed in `BUSINESS_REQUIREMENTS.md` #1 — if usage-based billing is deferred, the
   `MonthlyWasteRecord*` tables can be deferred to a later phase without touching Invoice.
2. Whether `RateCard` should support a per-Route or per-Taluka default in addition to per-Customer,
   for faster onboarding of many similar customers on one route (bulk rate assignment) — not in the
   original spec, worth asking given the real data's scale (770+ HCEs).
