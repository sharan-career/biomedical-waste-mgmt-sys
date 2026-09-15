'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { FacilityTypePieChart } from '@/components/charts/facility-type-pie-chart';
import { MonthlyCollectionChart } from '@/components/charts/monthly-collection-chart';
import { TalukaAgingStackedChart } from '@/components/charts/taluka-aging-stacked-chart';
import { RequireAuth } from '@/components/require-auth';
import { getDashboardSummary } from '@/lib/dashboard-api';

function Card({ label, value, tone }: { label: string; value: string; tone?: 'danger' | 'default' }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone === 'danger' ? 'text-red-600' : 'text-gray-900'}`}>
        ₹{value}
      </p>
    </div>
  );
}

function DashboardContent() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard-summary'], queryFn: getDashboardSummary });
  const summary = data?.data;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>

      {isLoading && <p className="text-sm text-gray-500">Loading dashboard…</p>}

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card label="Total Outstanding" value={summary.cards.totalOutstanding} />
            <Card label="Total Overdue" value={summary.cards.totalOverdue} tone="danger" />
            <Card label="Collection This Month" value={summary.cards.collectionThisMonth} />
            <Card label="Due This Week" value={summary.cards.dueThisWeek} />
            <Card label="Overdue 1-30 days" value={summary.cards.overdue1To30} />
            <Card label="Overdue 31-60 days" value={summary.cards.overdue31To60} />
            <Card label="Overdue 61-90 days" value={summary.cards.overdue61To90} />
            <Card label="Overdue 90+ days" value={summary.cards.overdue90Plus} tone="danger" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-gray-900">Customers by Facility Type</h2>
              <FacilityTypePieChart data={summary.facilityTypeBreakdown} />
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-gray-900">Outstanding by Taluka &amp; Age</h2>
              <TalukaAgingStackedChart data={summary.talukaAgingBreakdown} />
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
              <h2 className="mb-2 text-sm font-semibold text-gray-900">Monthly Collection Trend</h2>
              <MonthlyCollectionChart data={summary.monthlyCollectionTrend} />
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-gray-900">Top Overdue Customers</h2>
              <ul className="divide-y divide-gray-100 text-sm">
                {summary.topOverdueCustomers.length === 0 && (
                  <li className="py-2 text-gray-500">None — nothing overdue right now.</li>
                )}
                {summary.topOverdueCustomers.map((c) => (
                  <li key={c.id} className="flex justify-between py-2">
                    <Link href={`/customers/${c.id}`} className="text-blue-600 hover:underline">
                      {c.organizationName}
                    </Link>
                    <span className="font-medium text-gray-900">₹{c.outstandingAmount}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-gray-900">Follow-ups Today</h2>
              <p className="text-2xl font-semibold text-gray-900">{summary.followUpsTodayCount}</p>
              <Link href="/follow-ups" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
                View queue →
              </Link>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-gray-900">Recent Payments</h2>
              <ul className="divide-y divide-gray-100 text-sm">
                {summary.recentPayments.length === 0 && <li className="py-2 text-gray-500">None yet.</li>}
                {summary.recentPayments.map((p) => (
                  <li key={p.id} className="flex justify-between py-2">
                    <span className="text-gray-700">{p.customer.organizationName}</span>
                    <span className="font-medium text-gray-900">₹{p.amount}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-gray-900">Recent Invoices</h2>
              <ul className="divide-y divide-gray-100 text-sm">
                {summary.recentInvoices.length === 0 && <li className="py-2 text-gray-500">None yet.</li>}
                {summary.recentInvoices.map((inv) => (
                  <li key={inv.id} className="flex justify-between py-2">
                    <Link href={`/invoices/${inv.id}`} className="text-blue-600 hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                    <span className="font-medium text-gray-900">₹{inv.totalAmount}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
