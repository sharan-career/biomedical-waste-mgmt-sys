'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { listInvoices } from '@/lib/billing-api';
import {
  applyCredit,
  getCreditBalance,
  listPayments,
  recordPayment,
  reversePayment,
} from '@/lib/payments-api';
import type { PaymentMode } from '@/lib/types';

const PAYMENT_MODES: PaymentMode[] = ['BANK_TRANSFER', 'UPI', 'CHEQUE', 'CASH', 'OTHER'];

export function PaymentsPanel({ customerId, canManage }: { customerId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { data: paymentsData } = useQuery({
    queryKey: ['payments', { customerId }],
    queryFn: () => listPayments({ customerId, limit: 50 }),
  });
  const { data: creditData } = useQuery({
    queryKey: ['credit-balance', customerId],
    queryFn: () => getCreditBalance(customerId),
  });
  const { data: sentInvoicesData } = useQuery({
    queryKey: ['payable-invoices', customerId],
    queryFn: () => listInvoices({ customerId, status: 'SENT', limit: 50 }),
  });
  const { data: partialInvoicesData } = useQuery({
    queryKey: ['payable-invoices-partial', customerId],
    queryFn: () => listInvoices({ customerId, status: 'PARTIALLY_PAID', limit: 50 }),
  });

  const payments = paymentsData?.data ?? [];
  const availableCredit = Number(creditData?.data.availableCredit ?? '0');
  const payableInvoices = [...(sentInvoicesData?.data ?? []), ...(partialInvoicesData?.data ?? [])];

  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('BANK_TRANSFER');
  const [paymentDate, setPaymentDate] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [invoiceAllocations, setInvoiceAllocations] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [creditInvoiceId, setCreditInvoiceId] = useState('');
  const [creditAmount, setCreditAmount] = useState('');

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['payments', { customerId }] });
    await queryClient.invalidateQueries({ queryKey: ['credit-balance', customerId] });
    await queryClient.invalidateQueries({ queryKey: ['payable-invoices', customerId] });
    await queryClient.invalidateQueries({ queryKey: ['payable-invoices-partial', customerId] });
  };

  const handleRecord = async () => {
    const amountNum = Number(amount);
    if (!amountNum || !paymentDate) return;
    setSubmitting(true);
    setError(null);
    try {
      const allocations = Object.entries(invoiceAllocations)
        .filter(([, v]) => Number(v) > 0)
        .map(([invoiceId, v]) => ({ invoiceId, amount: Number(v) }));
      await recordPayment({
        customerId,
        amount: amountNum,
        paymentMode,
        paymentDate,
        referenceNumber: referenceNumber || undefined,
        allocations,
      });
      setAmount('');
      setPaymentDate('');
      setReferenceNumber('');
      setInvoiceAllocations({});
      setShowForm(false);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverse = async (paymentId: string) => {
    const reason = window.prompt('Reason for reversing this payment?');
    if (!reason) return;
    setError(null);
    try {
      await reversePayment(paymentId, reason);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reverse payment.');
    }
  };

  const handleApplyCredit = async () => {
    const amountNum = Number(creditAmount);
    if (!creditInvoiceId || !amountNum) return;
    setError(null);
    try {
      await applyCredit(customerId, creditInvoiceId, amountNum);
      setCreditInvoiceId('');
      setCreditAmount('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to apply credit.');
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Payments</h2>
        {canManage && (
          <button onClick={() => setShowForm((v) => !v)} className="text-sm text-blue-600 hover:underline">
            {showForm ? 'Cancel' : '+ Record Payment'}
          </button>
        )}
      </div>

      <p className="mb-3 text-sm text-gray-600">
        Available credit balance: <span className="font-medium text-gray-900">₹{availableCredit}</span>
      </p>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {showForm && (
        <div className="mb-4 space-y-3 rounded-md bg-gray-50 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              {PAYMENT_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <input
              placeholder="Reference # (optional)"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>

          {payableInvoices.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-gray-500">
                Allocate to invoices (optional — leftover becomes credit balance):
              </p>
              <div className="space-y-1">
                {payableInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center gap-2 text-sm">
                    <span className="w-40 truncate">{invoice.invoiceNumber}</span>
                    <span className="w-24 text-xs text-gray-500">₹{invoice.outstandingAmount} due</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={invoiceAllocations[invoice.id] ?? ''}
                      onChange={(e) =>
                        setInvoiceAllocations({ ...invoiceAllocations, [invoice.id]: e.target.value })
                      }
                      className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => void handleRecord()}
            disabled={submitting}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
          >
            Record Payment
          </button>
        </div>
      )}

      {canManage && availableCredit > 0 && payableInvoices.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-blue-50 p-3 text-sm">
          <span className="text-gray-700">Apply credit to:</span>
          <select
            value={creditInvoiceId}
            onChange={(e) => setCreditInvoiceId(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">Select invoice…</option>
            {payableInvoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.invoiceNumber} (₹{invoice.outstandingAmount} due)
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Amount"
            value={creditAmount}
            onChange={(e) => setCreditAmount(e.target.value)}
            className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
          <button
            onClick={() => void handleApplyCredit()}
            className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      )}

      <ul className="divide-y divide-gray-100 text-sm">
        {payments.length === 0 && <li className="py-2 text-gray-500">No payments yet.</li>}
        {payments.map((payment) => (
          <li key={payment.id} className="py-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-900">₹{payment.amount}</span>{' '}
                <span className="text-gray-500">
                  {payment.paymentMode} · {new Date(payment.paymentDate).toLocaleDateString()}
                </span>
                {payment.referenceNumber && (
                  <span className="text-gray-500"> · Ref: {payment.referenceNumber}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    payment.status === 'RECORDED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {payment.status}
                </span>
                {canManage && payment.status === 'RECORDED' && !payment.reversalOfPaymentId && (
                  <button
                    onClick={() => void handleReverse(payment.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Reverse
                  </button>
                )}
              </div>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {payment.allocations.map((a) => (
                <span key={a.id} className="mr-3">
                  {a.invoice ? `${a.invoice.invoiceNumber}: ₹${a.allocatedAmount}` : `Credit balance: ₹${a.allocatedAmount}`}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
