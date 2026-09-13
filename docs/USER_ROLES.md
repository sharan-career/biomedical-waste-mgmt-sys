# User Roles & Permission Matrix

Phase 0 deliverable. Four roles per the master spec: Super Admin, Accounts Manager, Collection
Executive, Management. Permissions are enforced server-side (NestJS guards), never UI-only.

---

## 1. Role Summaries

| Role | Who they are in real life | Primary job in this system |
|---|---|---|
| **Super Admin** | Owner/IT admin | Full system control: users, roles, pricing, system settings |
| **Accounts Manager** | Finance/accounts staff currently using Tally manually | Runs billing, payments, outstanding tracking, assigns follow-ups |
| **Collection Executive** | Field/phone staff who chase payments | Works their assigned "Follow-ups Today" list, logs calls/promises |
| **Management** | Owner(s)/directors | Read-only dashboards and reports — no data entry |

## 2. Permission Matrix

Legend: **C**reate, **R**ead, **U**pdate, **D**elete, **A**pprove/special-action. `—` = no access.

| Module / Action | Super Admin | Accounts Manager | Collection Executive | Management |
|---|---|---|---|---|
| **Users & Roles** | CRUD | — | — | — |
| **System Settings** (reminder rules, pricing config, tax rates) | CRUD | R | — | R |
| **Customers** | CRUD | CRUD | R (own assigned only) | R |
| **Contracts** | CRUD | CRUD | — | R |
| **Pricing / Rate Cards** | CRUD | R, propose changes (see Open Question) | — | R |
| **Invoices** — draft/edit | CRUD | CRUD | — | R |
| **Invoices** — approve/send | A | A | — | — |
| **Invoices** — cancel | CRUD | U (cancel with reason) | — | R |
| **Payments** — record | CRUD | CRUD | — | R |
| **Payments** — modify/reverse | CRUD | U (with audit reason, no delete) | — | R |
| **Outstanding / Aging views** | R | R (all customers) | R (assigned customers only) | R (all) |
| **Follow-ups** — create/assign | CRUD | CRUD (assign to executives) | C, U (own only) | R |
| **Follow-ups** — log call/promise | CRUD | CRUD | CU (own assigned) | R |
| **Reminders** — configure rules | CRUD | R | — | R |
| **Reminders** — log/view sent history | R | R | R (their customers) | R |
| **Reports** (all types) | R + export | R + export | R (own performance + assigned customers) | R + export |
| **Dashboard** | Full | Full (financial focus) | Own-scoped (assigned customers/follow-ups) | Full, read-only |
| **Audit Log** | R (full) | R (own actions + financial entities) | — | — |

## 3. Notes and Design Implications

- **Collection Executive scoping**: every query for this role must filter by `assignedTo =
  currentUserId` at the data-access layer, not just in the UI — a Collection Executive must never
  be able to fetch another executive's customer list via direct API call. This is a first-class
  authorization rule, not a display convenience.
- **"Cannot modify critical financial information"** (spec, for Collection Executive) is
  interpreted as: no create/update/delete on Invoice, Payment, Contract, or Pricing entities at
  all — only Follow-up records (their own) and read access to Outstanding data for their assigned
  customers.
- **Accounts Manager vs Super Admin split**: the spec gives Accounts Manager broad CRUD but reserves
  user/role management and system settings for Super Admin. Invoice *approval* is modeled as a
  distinct action from invoice *creation* — this supports a maker-checker pattern later (e.g., one
  Accounts Manager drafts, a Super Admin or senior Accounts Manager approves) even if MVP allows
  the same user to do both; the permission and the audit trail should still record it as a distinct
  action.
- **Payment reversal, not deletion**: payments are never hard-deleted by any role — a "reversal" is
  itself a new, audited transaction that nets against the original, preserving the full history.
  This matters for the database design (see `DATABASE_DESIGN.md`) and for financial auditability.
- **Management role is genuinely read-only everywhere**, including no ability to export raw
  customer PII beyond what's needed for the reports listed in Module 11 — flagged as a data-privacy
  consideration, not just a permissions one.

## 4. Open Questions

1. Can a single physical person hold more than one role (e.g., an Accounts Manager who also does
   follow-up calls)? If yes, role assignment needs to support multiple roles per user, not a single
   `role` enum column on the User entity.
2. Does "Accounts Manager can manage pricing" mean full CRUD on rate cards, or only *proposing*
   changes that a Super Admin approves? The master spec lists Pricing under Super Admin's module
   list but also implies Accounts Manager manages invoices, which depend on pricing — needs
   clarification before Module 4 implementation.
3. Should Collection Executives be scoped by **Route/Taluka** (matching the real-world data
   structure) rather than, or in addition to, individual customer assignment? This affects how
   "assigned customers" is modeled — a direct customer→executive mapping vs. a
   route/territory→executive mapping.
4. Is there a need for a lightweight fifth role — e.g., a "Data Entry" user who only enters monthly
   waste-quantity data from Codeland reports, without full Accounts Manager privileges? Not in the
   original spec, but the discovered real workflow (manual monthly data entry) suggests it might be
   worth a narrowly-scoped role rather than giving that access to everyone with Accounts Manager
   rights.
