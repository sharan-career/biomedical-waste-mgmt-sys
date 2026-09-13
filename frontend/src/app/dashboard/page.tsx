'use client';

import Link from 'next/link';
import { RequireAuth } from '@/components/require-auth';
import { useAuth } from '@/lib/auth-context';

function DashboardContent() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
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
        <div className="mt-6 border-t border-gray-100 pt-4">
          <Link
            href="/customers"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Customers
          </Link>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Contract, Billing, Payments, Collections, and Reports modules land in later phases.
        </p>
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
