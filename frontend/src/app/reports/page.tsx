'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { RequireAuth } from '@/components/require-auth';
import { downloadReportCsv, fetchReport, REPORT_TYPES, type ReportType } from '@/lib/reports-api';

function GenericTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-500">No data for this filter.</p>;
  }
  const columns = Object.keys(rows[0]);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th key={col} className="whitespace-nowrap px-3 py-2 text-left font-medium text-gray-500">
                {col.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col} className="whitespace-nowrap px-3 py-2 text-gray-700">
                  {String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportsContent() {
  const [reportType, setReportType] = useState<ReportType>('customer-outstanding');
  const [customerId, setCustomerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const params = { customerId: customerId || undefined, startDate: startDate || undefined, endDate: endDate || undefined };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['report', reportType, params],
    queryFn: () => fetchReport(reportType, params),
    retry: false,
  });

  const rows: Record<string, unknown>[] = (() => {
    if (!data?.data) return [];
    if (reportType === 'aging') {
      const aging = data.data as { invoices: Record<string, unknown>[] };
      return aging.invoices;
    }
    return data.data as Record<string, unknown>[];
  })();

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      await downloadReportCsv(reportType, params);
    } catch {
      setError('Failed to export CSV.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <div>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-gray-900">Reports</h1>
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Report</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              {REPORT_TYPES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Customer ID (optional)</label>
            <input
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="UUID"
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">End date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={() => void handleExport()}
            disabled={exporting}
            className="ml-auto rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          {isLoading && <p className="py-6 text-center text-sm text-gray-500">Loading…</p>}
          {isError && (
            <p className="py-6 text-center text-sm text-red-600">
              Failed to load report — for &quot;Customer Payment History&quot;, a Customer ID is required.
            </p>
          )}
          {!isLoading && !isError && <GenericTable rows={rows} />}
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <RequireAuth>
      <ReportsContent />
    </RequireAuth>
  );
}
