'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { RequireAuth } from '@/components/require-auth';
import { useAuth } from '@/lib/auth-context';
import { listCustomers } from '@/lib/customers-api';

function CustomersContent() {
  const { hasRole } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['customers', { search, page }],
    queryFn: () => listCustomers({ search, page, limit: 20 }),
  });

  const canManage = hasRole('SUPER_ADMIN', 'ACCOUNTS_MANAGER');
  const customers = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Customers</h1>
        {canManage && (
            <Link
              href="/customers/new"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              New Customer
            </Link>
          )}
        </div>

        <input
          type="text"
          placeholder="Search by name, code, or city…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="mb-4 w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Code</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Organization</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Taluka</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Facility</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    Loading…
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-red-600">
                    Failed to load customers.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && customers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    No customers yet.
                  </td>
                </tr>
              )}
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/customers/${customer.id}`} className="text-blue-600 hover:underline">
                      {customer.customerCode}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-900">{customer.organizationName}</td>
                  <td className="px-4 py-2 text-gray-600">{customer.taluka.name}</td>
                  <td className="px-4 py-2 text-gray-600">{customer.facilityType}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        customer.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {customer.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {meta && meta.total > meta.limit && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>
              Page {meta.page} of {totalPages} ({meta.total} total)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-gray-300 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-md border border-gray-300 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
    </div>
  );
}

export default function CustomersPage() {
  return (
    <RequireAuth>
      <CustomersContent />
    </RequireAuth>
  );
}
