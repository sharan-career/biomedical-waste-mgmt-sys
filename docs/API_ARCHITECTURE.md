# API Architecture

Phase 0 deliverable. NestJS, TypeScript, modular-per-domain, matching `DATABASE_DESIGN.md`
entities. No implementation yet — this defines module boundaries, endpoint shape, and
cross-cutting conventions so Phase 1+ has a consistent structure to build against.

---

## 1. Module Boundaries (NestJS modules)

```
AuthModule          — login, refresh, logout, password reset
UsersModule         — user + role management (Super Admin only)
CustomersModule     — customer CRUD, contacts, Taluka/Route lookups
ContractsModule     — contract CRUD, lifecycle
PricingModule       — rate cards, rate card components
WasteDataModule     — monthly waste record entry/import
BillingModule       — invoice generation (billing run), invoice CRUD/lifecycle
PaymentsModule      — payment recording, allocation, reversal
CollectionsModule   — follow-ups, outstanding/aging queries
RemindersModule     — reminder rules, reminder log, NotificationProvider abstraction
ReportsModule       — cross-module read/export endpoints
DashboardModule     — aggregate read endpoints for Module 10
AuditModule         — audit log read (Super Admin), and a shared AuditService other modules call
```

Each module owns its Prisma models' business logic; no module reaches into another module's
repository directly — cross-module needs go through the other module's service (e.g., BillingModule
calls `WasteDataService.getMonthlyTotals(...)`, it doesn't query `MonthlyWasteRecord` itself).

## 2. Auth Flow

- `POST /auth/login` — email + password → access token (short-lived, ~15 min) + refresh token
  (long-lived, stored hashed in `RefreshToken`, httpOnly cookie or secure storage on client).
- `POST /auth/refresh` — rotates the refresh token (old one revoked, new one issued) — refresh
  token reuse detection: if a revoked token is presented again, revoke the entire token family and
  force re-login (signals possible token theft).
- `POST /auth/logout` — revokes the current refresh token.
- Every protected route: `JwtAuthGuard` (validates access token) + `RolesGuard` (checks
  `@Roles(...)` decorator against the user's role(s)) +, where needed, a resource-ownership check
  (e.g., Collection Executive can only act on their own `FollowUp` rows) implemented as a
  request-scoped guard or service-level check, not just the route-level RolesGuard.

## 3. Endpoint Shape (representative, not exhaustive)

```
# Customers
GET    /customers                 ?talukaId=&routeId=&customerType=&status=&search=&page=&limit=
GET    /customers/:id
POST   /customers
PATCH  /customers/:id
PATCH  /customers/:id/status      { status: ACTIVE|INACTIVE }
GET    /customers/:id/financial-history

# Contracts
GET    /contracts?customerId=
POST   /contracts
PATCH  /contracts/:id

# Pricing
GET    /rate-cards?customerId=
POST   /rate-cards                (creates a new version, effectiveFrom set)
GET    /rate-cards/:id/components
POST   /rate-cards/:id/components

# Waste Data
POST   /waste-records             { customerId, periodMonth, lines: [{ wasteCategoryId, quantityKg }] }
POST   /waste-records/import      (CSV/bulk import for a Taluka/period)
GET    /waste-records?customerId=&periodMonth=

# Billing
POST   /billing-runs              { periodStart, periodEnd, contractIds?: [] }  -- generates DRAFT invoices
GET    /invoices                  ?status=&customerId=&overdue=true&talukaId=&page=&limit=
GET    /invoices/:id
POST   /invoices/:id/approve
POST   /invoices/:id/send
POST   /invoices/:id/cancel       { reason }
POST   /invoices/:id/credit-notes { reason, lines: [...] }

# Payments
POST   /payments                  { customerId, amount, mode, referenceNumber, date,
                                     allocations: [{ invoiceId, amount }] }
POST   /payments/:id/reverse      { reason }
GET    /payments?customerId=&dateFrom=&dateTo=

# Collections
GET    /follow-ups                ?assignedToId=&status=&date=      -- "Follow-ups Today"
POST   /follow-ups
PATCH  /follow-ups/:id            (status transition, adds a new history row per BUSINESS_WORKFLOW.md)
GET    /outstanding                ?customerId=&agingBucket=&talukaId=

# Reminders
GET    /reminder-rules
POST   /reminder-rules
PATCH  /reminder-rules/:id
GET    /reminder-logs             ?customerId=&invoiceId=&status=

# Reports
GET    /reports/outstanding
GET    /reports/aging
GET    /reports/collection-performance
GET    /reports/customer-payment-history/:customerId
...all support ?format=csv|xlsx&dateFrom=&dateTo=

# Dashboard
GET    /dashboard/summary          -- totals: outstanding, overdue, collected-this-month, due-this-week
GET    /dashboard/top-overdue-customers
GET    /dashboard/follow-ups-today
GET    /dashboard/recent-payments
GET    /dashboard/recent-invoices
```

## 4. Cross-Cutting Conventions

- **DTO validation**: every request body/query validated with `class-validator` DTOs at the
  controller boundary — reject with 400 before any business logic runs. (Master spec lists Zod for
  the frontend; backend uses NestJS's native `class-validator`/`class-transformer` pipeline, which
  is the idiomatic NestJS choice — frontend and backend validate independently, each in their
  ecosystem's normal tool, not sharing one validation library across the stack.)
- **Response envelope**: `{ data, meta }` for lists (`meta` = pagination info), `{ data }` for
  single resources, `{ error: { code, message, details? } }` for failures — one shape everywhere.
- **Pagination**: cursor-based for high-write-volume lists if needed later (per the interview-prep
  material's own guidance on offset-pagination drift); MVP can start with offset+limit given
  moderate expected list sizes (hundreds to low thousands of customers/invoices), revisit if a
  specific list becomes a problem.
- **Error handling**: a global `AllExceptionsFilter` normalizes NestJS/Prisma errors into the
  standard error envelope; domain-specific errors (e.g., "cannot cancel a paid invoice") are typed
  exceptions with meaningful codes (`INVOICE_ALREADY_PAID`), not generic 500s.
- **Idempotency**: `POST /payments` and `POST /billing-runs` accept an optional client-supplied
  `idempotencyKey` header — safe to retry on network failure without double-recording a payment or
  double-generating invoices.
- **Financial mutations are transactional**: any endpoint touching Invoice/Payment/CreditNote
  state wraps the read-modify-write in a Prisma `$transaction`, recomputing derived amounts
  (outstanding, paid) inside that same transaction — never in a separate follow-up call.
- **Every financial mutation writes an AuditLog entry** via the shared `AuditService`, inside the
  same transaction as the business change — not fire-and-forget after the response is sent, so an
  audit entry is never lost to a crash between "invoice updated" and "audit logged."
- **API documentation**: Swagger/OpenAPI generated from the same DTOs and decorators used for
  validation — no hand-maintained separate API doc that can drift from the code.
- **Versioning**: URL prefix `/api/v1/...` from day one, even though v1 is the only version — cheap
  insurance, per the API-design conventions already established in the interview-prep material.

## 5. Open Questions

1. Should invoice/payment endpoints require the maker-checker (approve as separate action) to be
   enforced at the API level for MVP, or is single-user approve+create acceptable for launch, with
   the audit trail simply recording both actions even if the same user performs them? (Ties to
   `USER_ROLES.md` open question #2.)
2. Delivery mechanism for `POST /invoices/:id/send` — email with PDF attachment, a customer portal
   link, or both? Affects whether a customer-facing read-only view/portal is in scope at all for
   MVP (not currently in the master spec's module list).
