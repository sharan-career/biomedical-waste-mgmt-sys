'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { createFollowUp, getFollowUpHistory } from '@/lib/follow-ups-api';
import type { FollowUpType } from '@/lib/types';

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-yellow-100 text-yellow-700',
  FOLLOW_UP_REQUIRED: 'bg-orange-100 text-orange-700',
  PROMISE_TO_PAY: 'bg-blue-100 text-blue-700',
  DISPUTED: 'bg-red-100 text-red-700',
  ESCALATED: 'bg-purple-100 text-purple-700',
  CLOSED: 'bg-gray-100 text-gray-600',
};

export function FollowUpsPanel({ customerId, canManage }: { customerId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['follow-up-history', customerId],
    queryFn: () => getFollowUpHistory(customerId),
  });
  const history = data?.data ?? [];

  const [showForm, setShowForm] = useState(false);
  const [assignedToId, setAssignedToId] = useState('');
  const [followUpType, setFollowUpType] = useState<FollowUpType>('PHONE_CALL');
  const [discussionNotes, setDiscussionNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!assignedToId.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createFollowUp({
        customerId,
        assignedToId,
        followUpDate: new Date().toISOString().slice(0, 10),
        followUpType,
        discussionNotes: discussionNotes || undefined,
      });
      setAssignedToId('');
      setDiscussionNotes('');
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ['follow-up-history', customerId] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create follow-up.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Follow-up History</h2>
        {canManage && (
          <button onClick={() => setShowForm((v) => !v)} className="text-sm text-blue-600 hover:underline">
            {showForm ? 'Cancel' : '+ New Follow-up'}
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {showForm && (
        <div className="mb-4 space-y-2 rounded-md bg-gray-50 p-3">
          <p className="text-xs text-gray-500">
            Assigned to (user ID — a picker will come once a Users directory page exists):
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              placeholder="Assigned user ID"
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
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
            <button
              onClick={() => void handleCreate()}
              disabled={submitting}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
            >
              Create
            </button>
          </div>
          <textarea
            placeholder="Discussion notes"
            value={discussionNotes}
            onChange={(e) => setDiscussionNotes(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            rows={2}
          />
        </div>
      )}

      <ul className="divide-y divide-gray-100 text-sm">
        {history.length === 0 && <li className="py-2 text-gray-500">No follow-ups yet.</li>}
        {history.map((followUp) => (
          <li key={followUp.id} className="py-2">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[followUp.status]}`}>
                {followUp.status}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(followUp.followUpDate).toLocaleDateString()} · {followUp.followUpType} ·{' '}
                {followUp.assignedTo.fullName}
              </span>
              {followUp.isSystemGenerated && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">Auto</span>
              )}
            </div>
            {followUp.discussionNotes && <p className="mt-1 text-gray-700">{followUp.discussionNotes}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
