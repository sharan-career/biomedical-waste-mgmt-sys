'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { generateInvoice, listInvoices } from '@/lib/billing-api';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  SENT: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

export function InvoicesPanel({
  contractId,
  contractStatus,
  canManage,
}: {
  contractId: string;
  contractStatus: string;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['invoices', { contractId }],
    queryFn: () => listInvoices({ contractId, limit: 50 }),
  });
  const invoices = data?.data ?? [];

  const [showForm, setShowForm] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleGenerate = async () => {
    if (!periodStart || !periodEnd) return;
    setSubmitting(true);
    setError(null);
    try {
      await generateInvoice({ contractId, billingPeriodStart: periodStart, billingPeriodEnd: periodEnd });
      setPeriodStart('');
      setPeriodEnd('');
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ['invoices', { contractId }] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Invoices</h2>
        {canManage && contractStatus === 'ACTIVE' && (
          <button onClick={() => setShowForm((v) => !v)} className="text-sm text-blue-600 hover:underline">
            {showForm ? 'Cancel' : '+ Generate Invoice'}
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {showForm && (
        <div className="mb-4 grid grid-cols-1 gap-2 rounded-md bg-gray-50 p-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Billing period start</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Billing period end</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={() => void handleGenerate()}
            disabled={submitting}
            className="self-end rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
          >
            Generate
          </button>
        </div>
      )}

      <ul className="divide-y divide-gray-100">
        {invoices.length === 0 && <li className="py-2 text-sm text-gray-500">No invoices yet.</li>}
        {invoices.map((invoice) => (
          <li key={invoice.id} className="flex items-center justify-between py-2 text-sm">
            <Link href={`/invoices/${invoice.id}`} className="text-blue-600 hover:underline">
              {invoice.invoiceNumber}
            </Link>
            <span className="text-gray-600">
              {new Date(invoice.billingPeriodStart).toLocaleDateString()} –{' '}
              {new Date(invoice.billingPeriodEnd).toLocaleDateString()}
            </span>
            <span className="font-medium text-gray-900">₹{invoice.totalAmount}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[invoice.status]}`}>
              {invoice.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
