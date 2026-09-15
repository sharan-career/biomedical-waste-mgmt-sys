'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { RequireAuth } from '@/components/require-auth';
import { ApiError } from '@/lib/api-client';
import {
  createReminderRule,
  listReminderLogs,
  listReminderRules,
  runReminderCheck,
  updateReminderRule,
  type ReminderRuleValues,
} from '@/lib/reminders-api';
import type { ReminderChannel, ReminderTriggerType } from '@/lib/types';

const STATUS_STYLES: Record<string, string> = {
  SENT: 'bg-green-100 text-green-700',
  DELIVERED: 'bg-green-100 text-green-700',
  READ: 'bg-blue-100 text-blue-700',
  FAILED: 'bg-red-100 text-red-700',
};

const EMPTY_FORM: ReminderRuleValues = {
  name: '',
  triggerType: 'DAYS_BEFORE_DUE',
  triggerOffsetDays: 3,
  channel: 'SMS',
  messageTemplate: 'Dear {{customerName}}, invoice {{invoiceNumber}} for Rs {{amount}} is due on {{dueDate}}.',
};

function RemindersContent() {
  const queryClient = useQueryClient();
  const { data: rulesData } = useQuery({ queryKey: ['reminder-rules'], queryFn: listReminderRules });
  const { data: logsData } = useQuery({
    queryKey: ['reminder-logs'],
    queryFn: () => listReminderLogs({ limit: 30 }),
  });
  const rules = rulesData?.data ?? [];
  const logs = logsData?.data ?? [];

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ReminderRuleValues>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['reminder-rules'] });
    await queryClient.invalidateQueries({ queryKey: ['reminder-logs'] });
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.messageTemplate.trim()) return;
    setError(null);
    try {
      await createReminderRule(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create rule.');
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    setError(null);
    try {
      await updateReminderRule(id, { active: !active });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update rule.');
    }
  };

  const handleRunCheck = async () => {
    setRunning(true);
    setRunResult(null);
    setError(null);
    try {
      const result = await runReminderCheck();
      setRunResult(
        `Sent: ${result.data.sent}, Failed: ${result.data.failed}, Skipped (disputed): ${result.data.skippedDisputed}`,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to run reminder check.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
              ← Dashboard
            </Link>
            <h1 className="mt-1 text-lg font-semibold text-gray-900">Automated Reminders</h1>
          </div>
          <button
            onClick={() => void handleRunCheck()}
            disabled={running}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {running ? 'Running…' : 'Run Check Now'}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {runResult && <p className="rounded-md bg-blue-50 p-2 text-sm text-blue-700">{runResult}</p>}

        <p className="text-xs text-gray-500">
          Real sending is stubbed for now (logged, not actually delivered) until a WhatsApp/SMS/Email
          provider is confirmed and wired in — see the NotificationProvider abstraction.
        </p>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Reminder Rules</h2>
            <button onClick={() => setShowForm((v) => !v)} className="text-sm text-blue-600 hover:underline">
              {showForm ? 'Cancel' : '+ New Rule'}
            </button>
          </div>

          {showForm && (
            <div className="mb-4 space-y-2 rounded-md bg-gray-50 p-3">
              <input
                placeholder="Rule name (e.g. '3 days overdue')"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <select
                  value={form.triggerType}
                  onChange={(e) => setForm({ ...form, triggerType: e.target.value as ReminderTriggerType })}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="DAYS_BEFORE_DUE">Days before due</option>
                  <option value="ON_DUE_DATE">On due date</option>
                  <option value="DAYS_AFTER_DUE">Days after due</option>
                </select>
                <input
                  type="number"
                  placeholder="Offset days"
                  value={form.triggerOffsetDays}
                  onChange={(e) => setForm({ ...form, triggerOffsetDays: Number(e.target.value) })}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
                <select
                  value={form.channel}
                  onChange={(e) => setForm({ ...form, channel: e.target.value as ReminderChannel })}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="SMS">SMS</option>
                  <option value="EMAIL">Email</option>
                </select>
              </div>
              <textarea
                placeholder="Message template — use {{customerName}}, {{invoiceNumber}}, {{amount}}, {{dueDate}}"
                value={form.messageTemplate}
                onChange={(e) => setForm({ ...form, messageTemplate: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                rows={2}
              />
              <button
                onClick={() => void handleCreate()}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              >
                Create Rule
              </button>
            </div>
          )}

          <ul className="divide-y divide-gray-100 text-sm">
            {rules.length === 0 && <li className="py-2 text-gray-500">No reminder rules yet.</li>}
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-medium text-gray-900">{rule.name}</span>{' '}
                  <span className="text-gray-500">
                    ({rule.channel}, {rule.triggerType.replace(/_/g, ' ').toLowerCase()}
                    {rule.triggerOffsetDays ? ` ${rule.triggerOffsetDays}d` : ''})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      rule.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {rule.active ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    onClick={() => void handleToggleActive(rule.id, rule.active)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {rule.active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Recent Reminder Activity</h2>
          <ul className="divide-y divide-gray-100 text-sm">
            {logs.length === 0 && <li className="py-2 text-gray-500">No reminders sent yet.</li>}
            {logs.map((log) => (
              <li key={log.id} className="py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900">{log.customer.organizationName}</span>{' '}
                    <span className="text-gray-500">
                      — {log.invoice.invoiceNumber} via {log.rule.name}
                    </span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[log.deliveryStatus]}`}>
                    {log.deliveryStatus}
                  </span>
                </div>
                {log.lastError && <p className="mt-1 text-xs text-red-600">{log.lastError}</p>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function RemindersPage() {
  return (
    <RequireAuth allowedRoles={['SUPER_ADMIN', 'ACCOUNTS_MANAGER']}>
      <RemindersContent />
    </RequireAuth>
  );
}
