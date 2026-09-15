'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ContractsPanel } from '@/components/contracts-panel';
import { CustomerForm, customerToFormDefaults, type CustomerFormData } from '@/components/customer-form';
import { FollowUpsPanel } from '@/components/follow-ups-panel';
import { PaymentsPanel } from '@/components/payments-panel';
import { RequireAuth } from '@/components/require-auth';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  addCustomerContact,
  getCustomer,
  removeCustomerContact,
  updateCustomer,
  updateCustomerStatus,
  type ContactFormValues,
} from '@/lib/customers-api';
import type { ContactType } from '@/lib/types';

function ContactsPanel({ customerId, canManage }: { customerId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['customer', customerId], queryFn: () => getCustomer(customerId) });
  const contacts = data?.data.contacts ?? [];

  const [form, setForm] = useState<ContactFormValues>({ contactType: 'PRIMARY', name: '', phone: '', email: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['customer', customerId] });

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await addCustomerContact(customerId, form);
      setForm({ contactType: 'PRIMARY', name: '', phone: '', email: '' });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add contact.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (contactId: string) => {
    try {
      await removeCustomerContact(customerId, contactId);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove contact.');
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">Contacts</h2>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <ul className="mb-4 divide-y divide-gray-100">
        {contacts.length === 0 && <li className="py-2 text-sm text-gray-500">No contacts yet.</li>}
        {contacts.map((contact) => (
          <li key={contact.id} className="flex items-center justify-between py-2 text-sm">
            <div>
              <span className="font-medium text-gray-900">{contact.name}</span>{' '}
              <span className="text-gray-500">({contact.contactType})</span>
              {contact.phone && <span className="ml-2 text-gray-600">{contact.phone}</span>}
              {contact.email && <span className="ml-2 text-gray-600">{contact.email}</span>}
            </div>
            {canManage && (
              <button
                onClick={() => void handleRemove(contact.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <select
            value={form.contactType}
            onChange={(e) => setForm({ ...form, contactType: e.target.value as ContactType })}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="PRIMARY">Primary</option>
            <option value="ACCOUNTS">Accounts</option>
            <option value="OTHER">Other</option>
          </select>
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <input
            placeholder="Phone (optional)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <input
              placeholder="Email (optional)"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <button
              onClick={() => void handleAdd()}
              disabled={submitting}
              className="whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerDetailContent() {
  const params = useParams<{ id: string }>();
  const customerId = params.id;
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => getCustomer(customerId),
  });

  const canManage = hasRole('SUPER_ADMIN', 'ACCOUNTS_MANAGER');
  const customer = data?.data;

  const handleUpdate = async (values: CustomerFormData) => {
    setError(null);
    try {
      await updateCustomer(customerId, values);
      await queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save changes.');
    }
  };

  const toggleStatus = async () => {
    if (!customer) return;
    setStatusUpdating(true);
    try {
      await updateCustomerStatus(customerId, customer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
      await queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  }
  if (isError || !customer) {
    return <div className="p-8 text-sm text-red-600">Customer not found.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
          <Link href="/customers" className="text-sm text-blue-600 hover:underline">
            ← Customers
          </Link>
          <div className="mt-1 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">{customer.organizationName}</h1>
            {canManage && (
              <button
                onClick={() => void toggleStatus()}
                disabled={statusUpdating}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {customer.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
              </button>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          {canManage ? (
            <CustomerForm
              defaultValues={customerToFormDefaults(customer)}
              onSubmit={handleUpdate}
              submitLabel="Save Changes"
            />
          ) : (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-gray-500">Customer code</dt>
                <dd className="text-sm text-gray-900">{customer.customerCode}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Taluka</dt>
                <dd className="text-sm text-gray-900">{customer.taluka.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Facility type</dt>
                <dd className="text-sm text-gray-900">{customer.facilityType}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Address</dt>
                <dd className="text-sm text-gray-900">
                  {customer.address}, {customer.city}, {customer.state} {customer.pincode}
                </dd>
              </div>
            </dl>
          )}
        </div>

        <ContractsPanel customerId={customerId} canManage={canManage} />
        <PaymentsPanel customerId={customerId} canManage={canManage} />
        <FollowUpsPanel customerId={customerId} canManage={canManage} />
        <ContactsPanel customerId={customerId} canManage={canManage} />
    </div>
  );
}

export default function CustomerDetailPage() {
  return (
    <RequireAuth>
      <CustomerDetailContent />
    </RequireAuth>
  );
}
