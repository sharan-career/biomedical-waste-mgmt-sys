import { apiRequest } from './api-client';
import type {
  Paginated,
  ReminderChannel,
  ReminderDeliveryStatus,
  ReminderLog,
  ReminderRule,
  ReminderTriggerType,
} from './types';

function buildQueryString<T extends object>(params: T): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export function listReminderRules(): Promise<{ data: ReminderRule[] }> {
  return apiRequest('/reminder-rules');
}

export interface ReminderRuleValues {
  name: string;
  triggerType: ReminderTriggerType;
  triggerOffsetDays: number;
  channel: ReminderChannel;
  messageTemplate: string;
  active?: boolean;
}

export function createReminderRule(dto: ReminderRuleValues): Promise<{ data: ReminderRule }> {
  return apiRequest('/reminder-rules', { method: 'POST', body: dto });
}

export function updateReminderRule(
  id: string,
  dto: Partial<ReminderRuleValues>,
): Promise<{ data: ReminderRule }> {
  return apiRequest(`/reminder-rules/${id}`, { method: 'PATCH', body: dto });
}

export interface ReminderLogListParams {
  page?: number;
  limit?: number;
  customerId?: string;
  invoiceId?: string;
  deliveryStatus?: ReminderDeliveryStatus;
}

export function listReminderLogs(params: ReminderLogListParams): Promise<Paginated<ReminderLog>> {
  return apiRequest(`/reminder-logs${buildQueryString(params)}`);
}

export function runReminderCheck(): Promise<{ data: { sent: number; failed: number; skippedDisputed: number } }> {
  return apiRequest('/reminders/run-check', { method: 'POST' });
}
