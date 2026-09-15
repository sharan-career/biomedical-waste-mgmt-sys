'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { RequireAuth } from '@/components/require-auth';
import { useAuth } from '@/lib/auth-context';
import { getDashboardSummary } from '@/lib/dashboard-api';

const NAV_LINKS = [
  { href: '/customers', label: 'Customers', primary: true },
  { href: '/aging', label: 'Outstanding / Aging' },
  { href: '/follow-ups', label: 'Follow-ups Today' },
  { href: '/reminders', label: 'Reminders' },
  { href: '/reports', label: 'Reports' },
];

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
  const { user, logout } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard-summary'], queryFn: getDashboardSummary });
  const summary = data?.data;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
            <button
              onClick={() => void logout()}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Log out
            </button>
          </div>
          <p className="text-sm text-gray-600">
            Signed in as <span className="font-medium text-gray-900">{user?.fullName}</span> ({user?.email})
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Roles: <span className="font-medium text-gray-900">{user?.roles.join(', ')}</span>
          </p>
          <div className="mt-6 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  link.primary
                    ? 'rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
                    : 'rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
                }
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

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
