'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { RequireAuth } from '@/components/require-auth';
import { getAgingReport } from '@/lib/payments-api';
import type { AgingBuckets } from '@/lib/types';

const BUCKET_LABELS: Record<keyof AgingBuckets, string> = {
  current: 'Current',
  days1To30: '1–30 days',
  days31To60: '31–60 days',
  days61To90: '61–90 days',
  days90Plus: '90+ days',
};

function AgingReportContent() {
  const { data, isLoading } = useQuery({ queryKey: ['aging-report'], queryFn: () => getAgingReport() });
  const report = data?.data;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-gray-900">Outstanding / Aging Report</h1>
        </div>

        {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

        {report && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(Object.keys(BUCKET_LABELS) as (keyof AgingBuckets)[]).map((bucket) => (
                <div key={bucket} className="rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm">
                  <p className="text-xs text-gray-500">{BUCKET_LABELS[bucket]}</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">₹{report.buckets[bucket]}</p>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Invoice</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Customer</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Due Date</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Days Past Due</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Outstanding</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Bucket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.invoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                        No outstanding invoices.
                      </td>
                    </tr>
                  )}
                  {report.invoices.map((item) => (
                    <tr key={item.invoiceId} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <Link href={`/invoices/${item.invoiceId}`} className="text-blue-600 hover:underline">
                          {item.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-gray-900">{item.customer.organizationName}</td>
                      <td className="px-4 py-2 text-gray-600">{new Date(item.dueDate).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{item.daysPastDue}</td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900">₹{item.outstandingAmount}</td>
                      <td className="px-4 py-2 text-gray-600">{BUCKET_LABELS[item.bucket]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AgingReportPage() {
  return (
    <RequireAuth>
      <AgingReportContent />
    </RequireAuth>
  );
}
