import { InvoiceStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Recomputes an invoice's paidAmount/outstandingAmount/status from the immutable trail of
 * PaymentAllocations + applied CreditNotes (see EDGE_CASES.md #7 and #14) — never hand-set
 * directly. Shared between PaymentsService and CreditNotesService so both payment recording
 * and credit note application affect the same invoice balance the same way.
 */
export async function recomputeInvoiceBalance(
  tx: Prisma.TransactionClient,
  invoiceId: string,
) {
  const [paymentSum, creditSum, invoice] = await Promise.all([
    tx.paymentAllocation.aggregate({
      where: { invoiceId },
      _sum: { allocatedAmount: true },
    }),
    tx.creditNote.aggregate({
      where: { invoiceId, status: 'APPLIED' },
      _sum: { amount: true },
    }),
    tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } }),
  ]);

  const totalAmount = new Decimal(invoice.totalAmount.toString());
  const covered = Decimal.max(
    0,
    new Decimal(
      (paymentSum._sum.allocatedAmount ?? new Decimal(0)).toString(),
    ).plus((creditSum._sum.amount ?? new Decimal(0)).toString()),
  );
  const outstandingAmount = Decimal.max(0, totalAmount.minus(covered));

  let status: InvoiceStatus = invoice.status;
  if (outstandingAmount.lessThanOrEqualTo(0) && covered.greaterThan(0)) {
    status = 'PAID';
  } else if (covered.greaterThan(0)) {
    status = 'PARTIALLY_PAID';
  } else if (invoice.status === 'PAID' || invoice.status === 'PARTIALLY_PAID') {
    status = 'SENT';
  }

  return tx.invoice.update({
    where: { id: invoiceId },
    data: { paidAmount: covered, outstandingAmount, status },
  });
}
