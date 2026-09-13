'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CustomerForm, customerToFormDefaults, type CustomerFormData } from '@/components/customer-form';
import { RequireAuth } from '@/components/require-auth';
import { ApiError } from '@/lib/api-client';
import { createCustomer } from '@/lib/customers-api';

function NewCustomerContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: CustomerFormData) => {
    setError(null);
    try {
      const response = await createCustomer(values);
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      router.push(`/customers/${response.data.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <Link href="/customers" className="text-sm text-blue-600 hover:underline">
          ← Customers
        </Link>
        <h1 className="mb-6 mt-1 text-lg font-semibold text-gray-900">New Customer</h1>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <CustomerForm
          defaultValues={customerToFormDefaults()}
          onSubmit={handleSubmit}
          submitLabel="Create Customer"
        />
      </div>
    </div>
  );
}

export default function NewCustomerPage() {
  return (
    <RequireAuth allowedRoles={['SUPER_ADMIN', 'ACCOUNTS_MANAGER']}>
      <NewCustomerContent />
    </RequireAuth>
  );
}
