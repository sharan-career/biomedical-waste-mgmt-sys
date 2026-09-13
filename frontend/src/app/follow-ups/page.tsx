'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { RequireAuth } from '@/components/require-auth';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  getTodaysFollowUps,
  reassignFollowUp,
  transitionFollowUp,
  type TransitionFollowUpValues,
} from '@/lib/follow-ups-api';
import type { FollowUpType } from '@/lib/types';

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-yellow-100 text-yellow-700',
  FOLLOW_UP_REQUIRED: 'bg-orange-100 text-orange-700',
  PROMISE_TO_PAY: 'bg-blue-100 text-blue-700',
  DISPUTED: 'bg-red-100 text-red-700',
  ESCALATED: 'bg-purple-100 text-purple-700',
  CLOSED: 'bg-gray-100 text-gray-600',
};

const TRANSITION_STATUSES: TransitionFollowUpValues['status'][] = [
  'FOLLOW_UP_REQUIRED',
  'PROMISE_TO_PAY',
  'DISPUTED',
  'ESCALATED',
  'CLOSED',
];

function TransitionForm({ followUpId, onDone }: { followUpId: string; onDone: () => void }) {
  const [status, setStatus] = useState<TransitionFollowUpValues['status']>('FOLLOW_UP_REQUIRED');
  const [followUpType, setFollowUpType] = useState<FollowUpType>('PHONE_CALL');
  const [discussionNotes, setDiscussionNotes] = useState('');
  const [promiseAmount, setPromiseAmount] = useState('');
  const [promisePaymentDate, setPromisePaymentDate] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await transitionFollowUp(followUpId, {
        status,
        followUpDate: new Date().toISOString().slice(0, 10),
        followUpType,
        discussionNotes: discussionNotes || undefined,
        promiseAmount: promiseAmount ? Number(promiseAmount) : undefined,
        promisePaymentDate: promisePaymentDate || undefined,
        nextFollowUpDate: nextFollowUpDate || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update follow-up.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-2 space-y-2 rounded-md bg-gray-50 p-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TransitionFollowUpValues['status'])}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          {TRANSITION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={followUpType}
          onChange={(e) => setFollowUpType(e.target.value as FollowUpType)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="PHONE_CALL">Phone Call</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="EMAIL">Email</option>
          <option value="VISIT">Visit</option>
          <option value="OTHER">Other</option>
        </select>
        <input
          type="date"
          placeholder="Next follow-up date"
          value={nextFollowUpDate}
          onChange={(e) => setNextFollowUpDate(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>
      <textarea
        placeholder="Discussion notes"
        value={discussionNotes}
        onChange={(e) => setDiscussionNotes(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        rows={2}
      />
      {status === 'PROMISE_TO_PAY' && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Promise amount"
            value={promiseAmount}
            onChange={(e) => setPromiseAmount(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <input
            type="date"
            placeholder="Promise date"
            value={promisePaymentDate}
            onChange={(e) => setPromisePaymentDate(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
      )}
      <button
        onClick={() => void handleSubmit()}
        disabled={submitting}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
      >
        Save
      </button>
    </div>
  );
}

function FollowUpsTodayContent() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isExecutive = hasRole('COLLECTION_EXECUTIVE') && !hasRole('SUPER_ADMIN', 'ACCOUNTS_MANAGER');
  const assignedToId = isExecutive ? user?.id : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['follow-ups-today', assignedToId],
    queryFn: () => getTodaysFollowUps(assignedToId),
  });
  const followUps = data?.data ?? [];

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['follow-ups-today'] });

  const handleReassignToMe = async (followUpId: string) => {
    if (!user) return;
    setError(null);
    try {
      await reassignFollowUp(followUpId, user.id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reassign.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <div>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-gray-900">Follow-ups Today</h1>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

        <div className="space-y-3">
          {!isLoading && followUps.length === 0 && (
            <p className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
              No follow-ups due today.
            </p>
          )}
          {followUps.map((followUp) => (
            <div key={followUp.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{followUp.customer.organizationName}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[followUp.status]}`}
                    >
                      {followUp.status}
                    </span>
                    {followUp.isSystemGenerated && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                        System-generated
                      </span>
                    )}
                  </div>
                  {followUp.invoice && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      Invoice {followUp.invoice.invoiceNumber} — ₹{followUp.invoice.outstandingAmount} due
                    </p>
                  )}
                  <p className="mt-1 text-sm text-gray-600">{followUp.discussionNotes}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Assigned to: {followUp.assignedTo.fullName}
                    {followUp.status === 'PROMISE_TO_PAY' && followUp.promisePaymentDate && (
                      <> · Promised ₹{followUp.promiseAmount} by {new Date(followUp.promisePaymentDate).toLocaleDateString()}</>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!isExecutive && (
                    <button
                      onClick={() => void handleReassignToMe(followUp.id)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Take
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedId(expandedId === followUp.id ? null : followUp.id)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {expandedId === followUp.id ? 'Cancel' : 'Log Contact'}
                  </button>
                </div>
              </div>

              {expandedId === followUp.id && (
                <TransitionForm
                  followUpId={followUp.id}
                  onDone={() => {
                    setExpandedId(null);
                    void refresh();
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FollowUpsTodayPage() {
  return (
    <RequireAuth>
      <FollowUpsTodayContent />
    </RequireAuth>
  );
}
