'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { createContract, listContracts, type ContractFormValues } from '@/lib/contracts-api';
import type { BillingFrequency } from '@/lib/types';

const EMPTY_FORM: ContractFormValues = {
  contractNumber: '',
  customerId: '',
  startDate: '',
  billingFrequency: 'MONTHLY',
};

export function ContractsPanel({ customerId, canManage }: { customerId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['contracts', { customerId }],
    queryFn: () => listContracts({ customerId, limit: 50 }),
  });
  const contracts = data?.data ?? [];

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ContractFormValues>({ ...EMPTY_FORM, customerId });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!form.contractNumber.trim() || !form.startDate) return;
    setSubmitting(true);
    setError(null);
    try {
      await createContract({ ...form, customerId });
      setForm({ ...EMPTY_FORM, customerId });
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ['contracts', { customerId }] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create contract.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Contracts</h2>
        {canManage && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="text-sm text-blue-600 hover:underline"
          >
            {showForm ? 'Cancel' : '+ New Contract'}
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {showForm && (
        <div className="mb-4 grid grid-cols-1 gap-2 rounded-md bg-gray-50 p-3 sm:grid-cols-4">
          <input
            placeholder="Contract number"
            value={form.contractNumber}
            onChange={(e) => setForm({ ...form, contractNumber: e.target.value })}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <select
            value={form.billingFrequency}
            onChange={(e) =>
              setForm({ ...form, billingFrequency: e.target.value as BillingFrequency })
            }
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="HALF_YEARLY">Half-yearly</option>
            <option value="YEARLY">Yearly</option>
            <option value="CUSTOM">Custom</option>
          </select>
          <button
            onClick={() => void handleCreate()}
            disabled={submitting}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
          >
            Create
          </button>
        </div>
      )}

      <ul className="divide-y divide-gray-100">
        {contracts.length === 0 && <li className="py-2 text-sm text-gray-500">No contracts yet.</li>}
        {contracts.map((contract) => (
          <li key={contract.id} className="flex items-center justify-between py-2 text-sm">
            <Link href={`/contracts/${contract.id}`} className="text-blue-600 hover:underline">
              {contract.contractNumber}
            </Link>
            <span className="text-gray-600">{contract.billingFrequency}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                contract.status === 'ACTIVE'
                  ? 'bg-green-100 text-green-700'
                  : contract.status === 'DRAFT'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {contract.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
