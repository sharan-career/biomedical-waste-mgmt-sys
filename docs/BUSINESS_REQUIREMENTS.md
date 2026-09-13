# Business Requirements — Biomedical Waste Billing & Collection Management System

Phase 0 deliverable. Source: `prompts/main-context-prompt.md` (master spec) plus real operational
data in `prompts/business-docs/` (`ALL MOU.xlsx`, `19.JUN-2026 Monthly Report.xlsx`).

---

## 1. Business Context Recap

The company runs a **Common Biomedical Waste Treatment Facility (CBWTF)** serving Kalaburagi
district, Karnataka — collecting biomedical waste from ~770+ Health Care Establishments (HCEs)
across 4 Talukas (Kalaburagi City, Jewargi, Sedam, Chittapur), plus government hospitals reported
separately. Operations run through **Codeland** (waste collection/tracking) and finance through
**Tally** (manual, disconnected from operations). There is no system connecting "how much waste did
we collect from this customer" to "what do they owe us and did they pay."

This project is a **Billing + Accounts Receivable + Collection + Follow-up Management System** —
not a Codeland or Tally replacement. It sits between operational data (waste collected) and
financial data (invoices, payments), and owns the collections workflow neither existing system
handles.

## 2. What the Real Data Tells Us (validated against the master spec)

The monthly report (`19.JUN-2026 Monthly Report.xlsx`) confirms the pricing model must support
**per-kilogram, per-category billing**, not just a flat fee:

- Waste is tracked in **4 categories**: **Yellow, Red, Blue, White**, plus a **General** waste
  bucket — each with its own kg quantity per HCE per month. (This matches BMW Rules 2016 color
  coding used across India's biomedical waste sector.)
- Every HCE has a **facility type**: `BH` (Bedded Hospital), `CL` (Clinic), `DC` (Dental Clinic),
  `LAB` (Laboratory) — with a **bed count** for bedded facilities. Facility type and bed count are
  very likely inputs to the pricing model (e.g., per-bed fee for `BH`, flat fee for `CL`/`DC`/`LAB`).
- HCEs are grouped by **Taluka** (Kalaburagi, Jewargi, Sedam, Chittapur) and by a numbered
  **Route** (1–4, one per Taluka in the current data, but treat as its own field — routes could
  subdivide further later) — used today for collection logistics reporting, and useful for
  regional billing/collection reporting in the new system.
- **Government hospitals are reported as a distinct group** — likely billed differently (govt.
  contracts/rates, different payment terms/authority) from private HCEs. Confirm with the business
  (see Open Questions).
- The monthly report is literally the source data for whatever drives **usage-based invoicing** —
  this system needs a way to *receive* this monthly per-customer, per-category kg data (manual
  entry initially, Codeland import/integration later) and turn it into invoice line items.

`ALL MOU.xlsx` is the **customer master** — confirms customer fields: name, Taluka, address,
contact person (usually "Dr Name"), phone, PIN code, email, route, facility type, beds. This maps
directly onto Module 2 (Customer Management) in the master spec, with two additions: **Route** and
**Taluka/Region** should be first-class customer fields (not just address text), since reporting
and collection planning are organized around them today.

## 3. In Scope for MVP

All 11 functional modules from the master spec (Auth, Customer, Contract, Pricing/Rate Card,
Billing/Invoices, Payments, Outstanding/Aging, Follow-up, Reminders, Dashboard, Reports), with:

- Manual entry of monthly waste-quantity data per customer per category (the Codeland data, until
  an integration exists) as the trigger for usage-based invoice line items.
- Configurable pricing supporting flat fee, per-kg (by waste category), per-bed, per-pickup, and
  combinations — because the real data shows category-wise kg tracking already exists and bed
  count is already collected per customer.
- Customer classification that distinguishes **Government vs Private** HCEs at minimum, and
  captures **Taluka** and **Route** as structured fields, not free text.

## 4. Explicitly Out of Scope for MVP

- Tally integration (Module 12) — architecture must not preclude it, but no build work now.
- Codeland API integration — MVP uses manual/CSV entry of monthly waste data; live integration is
  a later phase once Codeland's data export/API capability is confirmed.
- Replacing Codeland's operational waste-tracking (route optimization, vehicle tracking, waste
  disposal/treatment records) — out of scope entirely, not just deferred.
- SMS/WhatsApp/Email provider implementation details — build the abstraction (Module 9), pick one
  concrete provider to implement first (see Open Questions), defer the rest.

## 5. Non-Functional Requirements

- **Data integrity for money**: decimal types only for currency, DB transactions around any
  operation touching invoice/payment state, full audit trail (who/what/when/before/after) on every
  financial mutation.
- **Usability for non-technical users**: Collection Executives and some Accounts staff are not
  highly technical — minimal clicks, clear status colors/badges, mobile-responsive (a Collection
  Executive doing a "Follow-up Today" call is likely on a phone, not a desktop).
- **Performance**: dashboard and "Follow-ups Today" screens must load fast even as customer count
  grows past 1,000+ (current MOU data already lists ~770+ HCEs across 4 Talukas) — needs indexed
  queries, not full-table aggregation on every page load.
- **Security**: role-based access control strictly enforced server-side (not just hidden UI),
  password hashing, JWT + refresh token rotation, audit logging on sensitive actions.
- **Extensibility**: reminder channel providers and (eventually) Tally export must be
  interface-driven, swappable without touching core business logic.
- **Availability**: this becomes the primary tool Collection Executives use daily for follow-ups —
  it needs to be reliably available during business hours; formal SLA/uptime targets to be defined
  with the business (see Open Questions).

## 6. Assumptions Requiring Validation

These are flagged, not silently assumed, per the Phase 0 instructions:

1. **Billing basis**: Is invoicing driven by *actual monthly kg collected* (variable, from
   Codeland/manual entry) per customer, or a *contracted flat/tiered rate* regardless of actual kg,
   with kg data used only for reporting/reconciliation? The master spec lists both flat and per-kg
   as "possible" models — real data suggests kg tracking is central, but the actual invoice-driving
   rule needs confirmation per customer/contract.
2. **Government hospital billing**: Are government HCEs invoiced at all through this system (e.g.,
   billed to a government department under a separate MOU/rate), or are they tracked for volume
   reporting only with billing handled entirely outside this system?
3. **Route as a business entity**: Is "Route" purely an operational/logistics grouping (Codeland's
   domain) or does it drive anything in billing/collection (e.g., a Collection Executive is
   assigned by route, and follow-ups should be filterable/assignable by route)?
4. **Multiple contracts per customer**: The spec allows it — what determines which contract an
   invoice is generated against when a customer has more than one active contract at the same time
   (e.g., a facility with beds under one contract and a lab under another)?
5. **Data source for monthly waste quantities**: Manual re-entry from Codeland reports (like the
   Excel files reviewed), a CSV export/import, or eventually a direct Codeland integration/API? This
   affects Module 4/5 design significantly and should be pinned down before Phase 4.
6. **GST/tax specifics**: Single GST rate for all services, or does it vary by service type
   (collection fee vs transportation vs additional services)? Needed for Module 4's tax calculation.
7. **Uptime/SLA and hosting**: Any existing hosting preference/constraint (on-prem, specific
   cloud), expected concurrent user count, and backup/retention requirements for financial records
   (statutory retention period for invoices in India is typically 8 years — confirm).
