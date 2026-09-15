'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { InvoicesPanel } from '@/components/invoices-panel';
import { RequireAuth } from '@/components/require-auth';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  activateRateCard,
  createRateCard,
  getContract,
  listRateCards,
  updateContractStatus,
  type RateCardComponentInput,
} from '@/lib/contracts-api';
import type { RateCardComponentType } from '@/lib/types';

const COMPONENT_TYPES: RateCardComponentType[] = [
  'FIXED_FEE',
  'PER_PICKUP',
  'PER_BED',
  'SERVICE_CHARGE',
  'DISCOUNT',
];

function NewRateCardForm({ contractId, onCreated }: { contractId: string; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [components, setComponents] = useState<RateCardComponentInput[]>([
    { componentType: 'FIXED_FEE', unitAmount: 0, taxable: false },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateComponent = (index: number, patch: Partial<RateCardComponentInput>) => {
    setComponents((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const handleSubmit = async () => {
    if (!name.trim() || !effectiveFrom) return;
    setSubmitting(true);
    setError(null);
    try {
      await createRateCard(contractId, { name, effectiveFrom, components });
      setName('');
      setEffectiveFrom('');
      setComponents([{ componentType: 'FIXED_FEE', unitAmount: 0, taxable: false }]);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create rate card.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-md bg-gray-50 p-4">
      <h3 className="mb-3 text-sm font-medium text-gray-900">New Rate Card</h3>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          placeholder="Name (e.g. 2026 Standard Rate)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <input
          type="date"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="space-y-2">
        {components.map((component, index) => (
          <div key={index} className="flex items-center gap-2">
            <select
              value={component.componentType}
              onChange={(e) =>
                updateComponent(index, { componentType: e.target.value as RateCardComponentType })
              }
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              {COMPONENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Amount"
              value={component.unitAmount}
              onChange={(e) => updateComponent(index, { unitAmount: Number(e.target.value) })}
              className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <label className="flex items-center gap-1 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={component.taxable ?? false}
                onChange={(e) => updateComponent(index, { taxable: e.target.checked })}
              />
              Taxable
            </label>
            {components.length > 1 && (
              <button
                onClick={() => setComponents((prev) => prev.filter((_, i) => i !== index))}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() =>
            setComponents((prev) => [...prev, { componentType: 'FIXED_FEE', unitAmount: 0, taxable: false }])
          }
          className="text-sm text-blue-600 hover:underline"
        >
          + Add component
        </button>
        <button
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="ml-auto rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
        >
          Save Rate Card
        </button>
      </div>
    </div>
  );
}

function ContractDetailContent() {
  const params = useParams<{ id: string }>();
  const contractId = params.id;
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [showNewRateCard, setShowNewRateCard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: contractData, isLoading } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: () => getContract(contractId),
  });
  const { data: rateCardsData } = useQuery({
    queryKey: ['contract-rate-cards', contractId],
    queryFn: () => listRateCards(contractId),
  });

  const canManage = hasRole('SUPER_ADMIN', 'ACCOUNTS_MANAGER');
  const contract = contractData?.data;
  const rateCards = rateCardsData?.data ?? [];

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
    await queryClient.invalidateQueries({ queryKey: ['contract-rate-cards', contractId] });
  };

  const handleActivate = async (rateCardId: string) => {
    setError(null);
    try {
      await activateRateCard(contractId, rateCardId);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to activate rate card.');
    }
  };

  const handleTerminate = async () => {
    setError(null);
    try {
      await updateContractStatus(contractId, 'TERMINATED');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update contract status.');
    }
  };

  if (isLoading) return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  if (!contract) return <div className="p-8 text-sm text-red-600">Contract not found.</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href={`/customers/${contract.customerId}`} className="text-sm text-blue-600 hover:underline">
          ← {contract.customer.organizationName}
        </Link>
          <div className="mt-1 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">{contract.contractNumber}</h1>
            <div className="flex items-center gap-2">
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
              {canManage && contract.status !== 'TERMINATED' && contract.status !== 'EXPIRED' && (
                <button
                  onClick={() => void handleTerminate()}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Terminate
                </button>
              )}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-gray-500">Billing frequency</dt>
              <dd className="text-gray-900">{contract.billingFrequency}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Start date</dt>
              <dd className="text-gray-900">{new Date(contract.startDate).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Active rate card</dt>
              <dd className="text-gray-900">{contract.activeRateCard?.name ?? '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Rate Cards</h2>
            {canManage && contract.status !== 'TERMINATED' && contract.status !== 'EXPIRED' && (
              <button
                onClick={() => setShowNewRateCard((v) => !v)}
                className="text-sm text-blue-600 hover:underline"
              >
                {showNewRateCard ? 'Cancel' : '+ New Rate Card'}
              </button>
            )}
          </div>

          {showNewRateCard && (
            <div className="mb-4">
              <NewRateCardForm
                contractId={contractId}
                onCreated={() => {
                  setShowNewRateCard(false);
                  void refresh();
                }}
              />
            </div>
          )}

          <ul className="divide-y divide-gray-100">
            {rateCards.length === 0 && (
              <li className="py-2 text-sm text-gray-500">No rate cards yet.</li>
            )}
            {rateCards.map((rateCard) => (
              <li key={rateCard.id} className="py-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900">{rateCard.name}</span>{' '}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                        rateCard.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : rateCard.status === 'DRAFT'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {rateCard.status}
                    </span>
                  </div>
                  {canManage && rateCard.status === 'DRAFT' && (
                    <button
                      onClick={() => void handleActivate(rateCard.id)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Activate
                    </button>
                  )}
                </div>
                <ul className="mt-1 text-xs text-gray-600">
                  {rateCard.components.map((component) => (
                    <li key={component.id}>
                      {component.componentType}: ₹{component.unitAmount}
                      {component.taxable ? ' (taxable)' : ''}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>

        <InvoicesPanel contractId={contractId} contractStatus={contract.status} canManage={canManage} />
    </div>
  );
}

export default function ContractDetailPage() {
  return (
    <RequireAuth>
      <ContractDetailContent />
    </RequireAuth>
  );
}
