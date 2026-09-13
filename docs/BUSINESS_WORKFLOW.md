# Business Workflow — Lifecycles

Phase 0 deliverable. Defines the end-to-end flow and the state machines for the four lifecycles
the master spec calls out explicitly: Invoice, Payment, Follow-up, Reminder.

---

## 1. End-to-End Flow

```
Customer (HCE) onboarded
        │  (name, Taluka, Route, facility type, beds, GST/PAN, contact)
        ▼
Contract created (billing frequency, payment terms, linked rate card)
        │
        ▼
Rate Card assigned (flat / per-kg-by-category / per-bed / per-pickup / combination)
        │
        ▼
Monthly waste-quantity data recorded per customer
        │  (Yellow/Red/Blue/White/General kg — manual entry from Codeland report today)
        ▼
Billing run (per contract's billing frequency: monthly/quarterly/half-yearly/yearly/custom)
        │
        ▼
Invoice generated (DRAFT) → reviewed → APPROVED → SENT to customer
        │
        ▼
Outstanding amount tracked (Total − Payments Received)
        │
        ├─► On-time payment → Payment recorded → Receipt → invoice PAID → done
        │
        └─► Overdue → Reminder engine fires (rule-based, by days overdue)
                  │
                  ▼
            Follow-up assigned to Collection Executive
                  │
                  ▼
            Call/visit logged → outcome (promise / dispute / escalate)
                  │
                  ▼
            Payment eventually recorded (full or partial) → allocated to invoice(s)
                  │
                  ▼
            Outstanding recalculated → reporting/dashboard reflects new state
```

Reporting (Module 11) and the Dashboard (Module 10) sit on top of this entire flow, always
reading current state — they are not a separate lifecycle.

## 2. Invoice Lifecycle

```
DRAFT → APPROVED → SENT → (PARTIALLY_PAID) → PAID
  │         │         │           │
  └─────────┴─────────┴───────────┴──► CANCELLED   (from any pre-PAID state, with reason)
                                  │
                                  └──► OVERDUE (derived: SENT/PARTIALLY_PAID + due date passed)
```

- **DRAFT**: created by billing run or manually; editable freely (line items, amounts).
- **APPROVED**: passed a review step (who approves — see `USER_ROLES.md` open question); line
  items now locked, only cancellation is allowed, not silent edits.
- **SENT**: delivered to customer (email/print/portal — delivery mechanism TBD); starts the due-date
  clock for reminders.
- **OVERDUE** is a *derived* status (due date < today AND balance > 0), not a value someone sets
  manually — recompute it, don't store it as the source of truth, or it will drift out of sync.
- **PARTIALLY_PAID**: at least one payment allocated, balance > 0.
- **PAID**: balance = 0 exactly (see `EDGE_CASES.md` for overpayment handling).
- **CANCELLED**: terminal; requires a reason (audit field) and is only reachable from a pre-PAID
  state — a fully or partially paid invoice cannot be silently cancelled without first addressing
  the payments already applied to it (refund/credit note/reallocation — see edge cases).

## 3. Payment Lifecycle

```
Payment recorded (mode, amount, reference, date)
        │
        ▼
Allocated to one or more invoices (full or partial, possibly split across invoices)
        │
        ▼
Invoice balance(s) recalculated → invoice status updated (PARTIALLY_PAID / PAID)
        │
        ▼
Receipt generated
        │
        └──► (if needed later) Reversal recorded as a new offsetting transaction,
             never a delete — original payment and reversal both remain in history,
             invoice balances recalculated again, full audit trail preserved.
```

- A single payment can be split across multiple invoices for the same customer (spec: "multiple
  payments against invoice" and implicitly the reverse — one payment, multiple invoices — needs
  confirming, see `EDGE_CASES.md`).
- Every allocation is its own record (`PaymentAllocation`), not just a foreign key on Payment, so a
  single payment can legitimately cover several invoices and each allocation is independently
  auditable and reversible.

## 4. Follow-up Lifecycle

```
OPEN (created — auto when invoice goes overdue, or manually)
  │
  ├──► FOLLOW_UP_REQUIRED  (initial contact attempted, needs another touch)
  │         │
  │         ▼
  ├──► PROMISE_TO_PAY   (customer committed to an amount + date)
  │         │
  │         ├─► payment received by/near promise date → CLOSED
  │         └─► promise missed → back to FOLLOW_UP_REQUIRED (new follow-up entry, history kept)
  │
  ├──► DISPUTED   (customer contests the invoice/amount)
  │         │
  │         └─► resolved → back to FOLLOW_UP_REQUIRED or CLOSED, depending on resolution
  │
  ├──► ESCALATED   (executive can't resolve — routed to Accounts Manager/Super Admin)
  │         │
  │         └─► resolved → CLOSED or back into the cycle
  │
  └──► CLOSED   (invoice paid, or follow-up otherwise resolved)
```

- Each state transition creates a **new follow-up record**, preserving full history per
  invoice/customer (never overwrite the previous entry) — this is what makes "customer payment
  history" and "employee collection performance" reports possible.
- `DISPUTED` should optionally freeze automated reminders for the disputed invoice until resolved,
  to avoid sending an "overdue" reminder for an amount the customer is actively contesting — flagged
  as a business-rule decision to confirm (see `EDGE_CASES.md`).

## 5. Reminder Lifecycle

```
Reminder rule matches (e.g., "3 days overdue") for an invoice
        │
        ▼
NotificationProvider.send() called (WhatsApp / Email / SMS — abstracted, see Module 9)
        │
        ├─► success → ReminderLog entry (SENT, timestamp, channel, message)
        │
        └─► failure → ReminderLog entry (FAILED, error) → does NOT silently retry forever;
                        needs a bounded retry policy (see `EDGE_CASES.md`) and visibility
                        so someone notices persistent failures for a given customer/channel
        │
        ▼
(if customer responds via a channel that supports it) response logged against the ReminderLog
```

- Reminder rules are evaluated on a schedule (e.g., a daily job) against all SENT/PARTIALLY_PAID/
  OVERDUE invoices — one rule can only fire once per invoice per rule-threshold (a duplicate-
  suppression key, e.g., `invoiceId + ruleId`, prevents the same "7 days overdue" reminder firing
  twice if the job runs more than once a day).
- A `DISPUTED` or `ESCALATED` follow-up status should be checked before firing a reminder — flagged
  for confirmation whether disputed invoices should still receive automated reminders.

## 6. How Monthly Waste Data Feeds Billing (new — from real data review)

This isn't in the original module list as its own lifecycle but is necessary connective tissue
discovered from the actual monthly reports:

```
Monthly waste collection happens (Codeland's domain, outside this system)
        │
        ▼
Monthly per-customer, per-category (Yellow/Red/Blue/White/General) kg totals produced
        │  (today: an Excel report per Taluk, like 19.JUN-2026 Monthly Report.xlsx)
        ▼
Data entered into this system (manual entry / CSV import for MVP)
        │
        ▼
Billing run reads this data for any customer whose active rate card includes
per-kg or per-category charges, computes usage charges, feeds into invoice generation
```

This is the piece that needs the earliest business confirmation (see `BUSINESS_REQUIREMENTS.md`
open question #1 and #5) since it determines whether Module 4/5 needs a "waste quantity" entity at
all for MVP, or whether MVP launches with flat/contracted pricing only and usage-based pricing is
phase 2.
