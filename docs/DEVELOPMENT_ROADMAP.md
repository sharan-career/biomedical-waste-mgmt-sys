# Development Roadmap

Phase 0 deliverable. Expands `prompts/development phases` into concrete scope per phase, mapped to
the master spec's modules and this Phase 0 discovery. **Do not start a phase until the previous one
is explicitly confirmed done and the next is explicitly requested — per the project's own
development rules.**

---

## Phase 0 — Product Discovery & Architecture *(this phase)*

**Status: in progress — this document is part of its own deliverable set.**

Output: `BUSINESS_REQUIREMENTS.md`, `USER_ROLES.md`, `BUSINESS_WORKFLOW.md`, `DATABASE_DESIGN.md`,
`API_ARCHITECTURE.md`, `EDGE_CASES.md`, `DEVELOPMENT_ROADMAP.md` (this file). No code.

**Exit criteria**: open questions in these docs reviewed with the business; any that change the
data model (usage-based billing scope, government-hospital billing, multi-contract behavior) are
resolved before Phase 1 starts, since they affect the schema Phase 1 sets up.

## Phase 1 — Foundation & Authentication

- Repo scaffolding: NestJS backend, Next.js frontend, shared TS config/lint rules, Prisma schema
  initialized from `DATABASE_DESIGN.md` §2 (Identity & Access) + §3 (Taluka/Route) only — the rest
  of the schema lands with the phase that needs it, not all at once.
- `AuthModule`: login, JWT + refresh token rotation, logout, password hashing (argon2/bcrypt).
- `UsersModule`: Super Admin user/role CRUD.
- `RolesGuard` + `@Roles()` decorator wired end-to-end with at least one protected sample route per
  role, so every later phase inherits a proven auth pattern instead of reinventing it.
- `AuditModule` skeleton + `AuditService` — even though nothing financial exists yet, the pattern
  (write audit entry in the same transaction as the change) should be proven here on user
  management actions first.
- Base CI: lint, typecheck, unit test job wired up before real feature code accumulates.

## Phase 2 — Customer Management

- `Taluka`/`Route` seed data (from `ALL MOU.xlsx` structure — 4 Talukas, route numbers).
- `CustomersModule`: full CRUD, search/filter (by Taluka, Route, facility type, customer type,
  status), `CustomerContact` sub-resource.
- Bulk import consideration: given ~770+ real HCEs already exist in `ALL MOU.xlsx`, this phase
  should include a one-time import script/tool to seed real customers from that file rather than
  manual re-entry — flag this as an explicit phase deliverable, not an afterthought.
- Customer financial history view (placeholder until Phases 4–6 exist; wire the endpoint shape now,
  populate it later).

## Phase 3 — Contracts & Pricing

- `ContractsModule`: CRUD, lifecycle (DRAFT → ACTIVE → EXPIRED/TERMINATED).
- `PricingModule`: `RateCard` + `RateCardComponent`, versioning (new version on rate change, never
  mutate an active/historical one).
- **Decision gate before this phase starts**: resolve `BUSINESS_REQUIREMENTS.md` open question #1
  (is billing usage-based or contracted-flat) — it determines whether `WasteDataModule` needs to
  exist before Phase 4, or can be deferred.

## Phase 4 — Invoice & Billing

- `WasteDataModule` (if Phase 3's decision gate confirms usage-based billing is in MVP scope):
  monthly waste record entry + CSV import.
- `BillingModule`: billing-run engine (reads active contracts due for billing in a period, applies
  rate card components ± waste data, generates `DRAFT` invoices), invoice approve/send/cancel
  lifecycle, `CreditNote` support.
- Invoice PDF/print generation (or defer to Phase 8 if a simple HTML/print view suffices for MVP —
  flag as a scope decision at phase start).

## Phase 5 — Payments & Outstanding

- `PaymentsModule`: record payment, allocation (including split-across-invoices per
  `EDGE_CASES.md` #3), reversal.
- Outstanding/aging calculation (Current, 1–30, 31–60, 61–90, 90+ buckets) as queries against
  `Invoice`, not a separately maintained table.
- Overpayment/credit-balance handling (`EDGE_CASES.md` #8).

## Phase 6 — Follow-up & Collection Management

- `CollectionsModule`: `FollowUp` CRUD + status lifecycle, "Follow-ups Today" primary screen for
  Collection Executives, assignment/reassignment (including bulk-by-Route per `EDGE_CASES.md`
  #11).
- Promise-to-pay tracking + broken-promise surfacing (`EDGE_CASES.md` #10) — needs a scheduled job,
  first one in the system; establish the job-scheduling pattern here (e.g., NestJS `@Cron` or a
  dedicated worker) since Phase 7 needs the same infrastructure immediately after.

## Phase 7 — Automated Reminders

- `RemindersModule`: `ReminderRule` config, `NotificationProvider` interface +
  one concrete implementation first (recommend WhatsApp or SMS — confirm which channel the business
  actually uses today, per `BUSINESS_REQUIREMENTS.md` open question — implement that one, stub the
  others behind the same interface).
- Scheduled rule evaluation job (reuses Phase 6's job infrastructure), duplicate-suppression via the
  `(ruleId, invoiceId)` unique constraint, bounded retry on failure (`EDGE_CASES.md` #12).

## Phase 8 — Dashboard & Reports

- `DashboardModule`: summary cards, top-overdue customers, follow-ups today, recent
  payments/invoices — all read-only aggregate endpoints.
- `ReportsModule`: the 8 reports listed in Module 11, with date/customer filters and CSV/Excel
  export.
- Reconciliation job (`EDGE_CASES.md` #14) — recomputed vs. stored outstanding-amount drift check —
  fits naturally here as a "production readiness" style safety net, or can move to Phase 10 if
  timeline is tight.

## Phase 9 — Tally Integration

- Explicitly deferred per the master spec. When scheduled: start with a one-way financial-data
  *export* (Invoice/Payment summary → a format Tally can import), not a live bidirectional sync.
  Architecture from Phase 1 onward must not have coupled core business logic to Tally's data shapes
  — this phase should require no changes to Modules 1–11's internals, only an additive export
  layer.

## Phase 10 — Production Readiness

- Load/performance testing against realistic data volume (770+ customers, years of invoice/payment
  history).
- Security review (auth, RBAC enforcement, dependency audit, secrets management).
- Backup/retention policy for financial records (confirm statutory retention requirement — flagged
  in `BUSINESS_REQUIREMENTS.md` open question #7).
- Observability: structured logging, error tracking, uptime monitoring.
- Deployment pipeline (CI/CD), environment configuration (dev/staging/prod), runbook for the
  scheduled jobs introduced in Phases 6–7.

---

## Cross-Phase Notes

- **Real customer data import** (Phase 2) is the single biggest opportunity to validate the schema
  early — importing the actual `ALL MOU.xlsx` will surface data-quality issues (missing emails,
  inconsistent facility-type values, duplicate HCE names across Talukas) before they become a
  production problem. Treat this import as a mini discovery exercise in its own right.
- **Every phase must leave the system buildable, testable, and deployable** per the master spec's
  development rules — no phase should merge with failing tests or a broken build, even if the
  phase's own feature is incomplete relative to the full module list.
- **Open questions from this Phase 0 doc set should be revisited before Phases 3, 4, and 9
  specifically** — those are the phases where an unresolved assumption (usage-based billing,
  government hospital billing, Tally's actual future integration shape) would be expensive to
  discover mid-implementation rather than before it starts.
