# Edge Cases

Phase 0 deliverable. Every item lists the scenario, the recommended handling, and whether it's
confirmed by the master spec or is a Phase 0 judgment call needing business validation.

---

## 1. Partial Payments

**Scenario**: Customer pays ₹5,000 against a ₹12,000 invoice.
**Handling**: `Payment` created, one `PaymentAllocation` of ₹5,000 against the invoice.
`Invoice.paidAmount` recomputed → ₹5,000, `outstandingAmount` → ₹7,000, `status` →
`PARTIALLY_PAID`. No special edge handling needed beyond the standard allocation flow — this is
the default case, not an exception. *(Confirmed by spec.)*

## 2. Multiple Payments Against One Invoice

**Scenario**: Customer pays in three installments over time.
**Handling**: Three `Payment` rows, each with its own `PaymentAllocation` to the same invoice.
Sum of non-reversed allocations = `paidAmount`. Full history preserved per payment (date, mode,
reference) — needed for `EDGE_CASES.md` #12 (auditability) and the "Customer Payment History"
report. *(Confirmed by spec.)*

## 3. One Payment Split Across Multiple Invoices

**Scenario**: Customer sends one bank transfer of ₹20,000 intended to cover two overdue invoices of
₹12,000 and ₹8,000.
**Handling**: One `Payment` row, two `PaymentAllocation` rows (₹12,000 + ₹8,000). Requires the
Accounts Manager UI to support "allocate this payment across N invoices" as a first-class action,
not just single-invoice payment entry. *(Judgment call — spec implies this via "payment allocation"
in Module 6 but doesn't spell out the multi-invoice-per-payment UI; recommend confirming this is
common enough in practice to prioritize for MVP vs. phase 2.)*

## 4. Payment Reversal

**Scenario**: A cheque bounces after being recorded as a payment.
**Handling**: Never delete the original `Payment`. Create a new `Payment` with
`reversalOfPaymentId` pointing to the original, `status = REVERSED` on the original, negative
allocations created that offset the original allocations. Invoice balances recompute automatically.
Reason is a required field (audit). *(Judgment call — spec doesn't explicitly cover bounced
cheques, but "financial auditability" and "never use floating point / always traceable" strongly
imply reversal-as-new-record over deletion; recommend confirming this matches how Accounts
currently handles a bounced cheque in Tally today, so the digital flow mirrors a process staff
already trust.)*

## 5. Invoice Cancellation With Payments Already Applied

**Scenario**: An invoice was partially paid, then needs to be cancelled (e.g., billed in error).
**Handling**: Block a direct cancel while `paidAmount > 0`. Require the Accounts Manager to first
either (a) issue a `CreditNote` for the invoice and reallocate the existing payment(s) to another
invoice, or (b) process the cancellation as cancel-plus-refund workflow (refund out of scope for
MVP per "no direct fund transfer automation" — logged as a manual reconciliation step). Cancelling
an invoice with zero payments applied is a simple status change + reason. *(Judgment call — needs
business confirmation on which of (a)/(b) matches real practice; recommend asking Accounts how a
billing error on an already-partially-paid invoice is handled in Tally today.)*

## 6. Customer Disputes an Invoice

**Scenario**: Customer says the billed kg quantity or amount is wrong.
**Handling**: Dispute captured as a `FollowUp` with `status = DISPUTED`, linked to the invoice.
Invoice itself is *not* auto-cancelled or modified — a dispute is a collections-workflow state, not
a billing state. Resolution either closes the dispute with no change (customer is wrong, or agrees
after clarification), or triggers a `CreditNote` if the business agrees the invoice needs
adjusting. Automated reminders for a disputed invoice: **recommend pausing them** while
`DISPUTED` is open, to avoid re-antagonizing a customer already in a billing conversation — flagged
as an explicit business-rule decision to confirm (referenced in `BUSINESS_WORKFLOW.md`).

## 7. Credit Notes

**Scenario**: Overbilling correction, goodwill discount, or a dispute resolution reduces what a
customer owes.
**Handling**: `CreditNote` linked to the original invoice, its own approval step (mirrors invoice
approval — someone shouldn't be able to silently write off receivables without a trace), and once
`APPLIED`, reduces the invoice's effective outstanding without altering the original invoice's
line items (preserves the original bill as issued, for audit). *(Confirmed by spec — "Credit
notes" explicitly listed as a Phase 0 focus area.)*

## 8. Overpayments

**Scenario**: Customer pays ₹15,000 against a ₹12,000 invoice (rounding, or paying an old balance
plus a bit extra).
**Handling**: Allocate ₹12,000 to the invoice (closes it as `PAID`), and record the remaining
₹3,000 as **unallocated credit balance** on the customer (a `PaymentAllocation` with no invoice, or
an explicit `CustomerCreditBalance` concept — modeled as a `PaymentAllocation` row where
`invoiceId` is null and the amount sits as available credit) that can be applied to a future
invoice or refunded. Never silently "lose" the ₹3,000 or attribute it to the wrong invoice.
*(Confirmed by spec — "Overpayments" explicitly listed; the exact mechanism — credit balance vs.
refund — is a judgment call recommending the credit-balance model since it needs no bank transfer
automation.)*

## 9. Multiple Active Contracts for the Same Customer

**Scenario**: A hospital has a bedded-ward contract and a separate lab-services contract, billed
differently.
**Handling**: Each `Invoice` links to exactly one `Contract` (not just Customer), so billing runs
must resolve "which contract does this invoice belong to" explicitly — either the billing run is
always run per-contract (not per-customer), or a customer with multiple contracts simply produces
multiple invoices per period, one per contract. Recommend the latter as the default MVP behavior:
**one invoice per active contract per billing period**, never merged, since merging risks
conflating two different rate cards' math into one invoice. *(Judgment call — flagged in
`BUSINESS_REQUIREMENTS.md` open question #4; needs business confirmation.)*

## 10. Promise-to-Pay Tracking and Missed Promises

**Scenario**: Customer promises ₹10,000 by the 15th; the 15th passes with no payment.
**Handling**: `FollowUp.promiseAmount` / `promisePaymentDate` are just data on the follow-up record
— nothing happens automatically to the invoice. A scheduled job (same cadence as the reminder
engine) checks for follow-ups in `PROMISE_TO_PAY` status whose `promisePaymentDate` has passed with
no matching payment, and either auto-transitions them to `FOLLOW_UP_REQUIRED` (creating a new
follow-up row) or surfaces them prominently on the Collection Executive's "Follow-ups Today"
screen as "broken promise" — a distinct, visually flagged case, since a broken promise is a
stronger signal than a first-time reminder. *(Confirmed by spec — "Promise-to-pay tracking"
explicitly listed as a focus area; the auto-transition mechanism is a judgment call.)*

## 11. Follow-up Assignment and Reassignment

**Scenario**: A Collection Executive goes on leave; their assigned customers/follow-ups need
reassignment.
**Handling**: `FollowUp.assignedToId` is mutable by Accounts Manager/Super Admin (bulk reassign by
Route, since customers are grouped by Route in the real data — supports "reassign all of Route 3"
in one action rather than one-by-one). Reassignment itself should be an audited action (who
reassigned, from whom, to whom, when) since collection-performance reporting depends on knowing who
was actually responsible for a follow-up at any given time — recommend a `previousAssignedToId`
captured on the follow-up history row rather than silently overwriting.

## 12. Reminder Failures and Duplicate Reminders

**Scenario**: WhatsApp API call fails (customer's number invalid, provider outage), or the reminder
job runs twice in one day due to a scheduler misfire.
**Handling — failures**: `ReminderLog.deliveryStatus = FAILED` recorded with the provider error; a
bounded retry (e.g., 2 retries with backoff, then stop and flag) prevents infinite retry loops
against a permanently invalid number. Persistent failures for a customer should surface on the
dashboard/report so staff know to fall back to a phone call. **Handling — duplicates**: a unique
constraint on `(ruleId, invoiceId)` in `ReminderLog` (per `DATABASE_DESIGN.md` §9) makes a duplicate
firing a no-op — the job checks-then-inserts, and the DB constraint is the final backstop even if
application logic has a bug. *(Confirmed by spec — "Reminder failures" and "Duplicate reminders"
explicitly listed as focus areas.)*

## 13. GST/Tax Handling

**Scenario**: Invoice must show GST correctly, potentially at different rates for different service
components.
**Handling**: Tax is computed per taxable `InvoiceLineItem` (component-level `taxable` flag already
in `RateCardComponent`/`InvoiceLineItem` design), summed into `Invoice.taxAmount` — not a single
flat percentage applied to the invoice total, so a future rate change or an exempt line item
doesn't require restructuring. GST number captured on Customer for compliance documentation on the
invoice PDF. *(Judgment call on rate granularity — flagged in `BUSINESS_REQUIREMENTS.md` open
question #6; confirm actual GST rate structure with Accounts before Module 4/5 implementation.)*

## 14. Financial Auditability

**Scenario**: "Why does this invoice show ₹8,000 outstanding when I thought it was fully paid?"
**Handling**: Every financial state (invoice amounts, payment allocations, credit notes) is
reconstructable purely from the immutable trail of `InvoiceLineItem` + `PaymentAllocation` +
`CreditNoteLineItem` rows plus the `AuditLog` — never from a mutable running-total field alone.
Recomputing `outstandingAmount` from first principles must always match the stored (cached, for
query performance) value; a scheduled reconciliation job that flags any drift between the two is
recommended as a Phase 8+ (reporting/production-readiness) safety net. *(Confirmed by spec as a
cross-cutting principle, not a single feature.)*

## 15. Customer Deactivation With Outstanding Balance

**Scenario**: A customer stops being a client (facility closed) but still owes money.
**Handling**: `Customer.status = INACTIVE` does not clear or hide outstanding invoices — inactive
customers with a balance > 0 must still appear in aging/outstanding reports (an inactive customer
who owes money is often exactly the case Management most wants visibility into, not less). Soft
delete (`deletedAt`) is reserved for genuine data-entry mistakes, not for legitimate former
customers. *(Judgment call — not explicitly in spec; recommend confirming this matches how
"activate/deactivate customer" in Module 2 is meant to behave.)*

## 16. Waste Quantity Discrepancy vs. Codeland Records (new — from real data review)

**Scenario**: Monthly kg entered into this system (manually, from a Codeland-generated report)
doesn't match what Codeland's own system says, due to a transcription error or a timing mismatch.
**Handling**: MVP has no live reconciliation against Codeland (no integration yet, per
`BUSINESS_REQUIREMENTS.md` scope). Recommend: (a) the person entering monthly data records which
Codeland report/date they sourced it from (a `sourceReference` free-text field on
`MonthlyWasteRecord`) so a dispute is traceable back to a specific document, and (b) once entered
and used in a billing run, a correction requires a new, dated entry (not silently editing the old
one) so historical invoices remain explainable even if the underlying kg figure was later found
wrong. *(New edge case, surfaced only after reviewing the actual monthly report structure — not
in the original master spec.)*
