import { apiRequest } from './api-client';
import type { FollowUp, FollowUpStatus, FollowUpType, Paginated } from './types';

function buildQueryString<T extends object>(params: T): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export interface FollowUpListParams {
  page?: number;
  limit?: number;
  customerId?: string;
  invoiceId?: string;
  assignedToId?: string;
  status?: FollowUpStatus;
}

export function listFollowUps(params: FollowUpListParams): Promise<Paginated<FollowUp>> {
  return apiRequest(`/follow-ups${buildQueryString(params)}`);
}

export function getTodaysFollowUps(assignedToId?: string): Promise<{ data: FollowUp[] }> {
  return apiRequest(`/follow-ups/today${buildQueryString({ assignedToId })}`);
}

export function getFollowUpHistory(customerId: string, invoiceId?: string): Promise<{ data: FollowUp[] }> {
  return apiRequest(`/follow-ups/history${buildQueryString({ customerId, invoiceId })}`);
}

export interface CreateFollowUpValues {
  customerId: string;
  invoiceId?: string;
  assignedToId: string;
  followUpDate: string;
  followUpType: FollowUpType;
  contactPerson?: string;
  discussionNotes?: string;
  customerResponse?: string;
  promiseAmount?: number;
  promisePaymentDate?: string;
  nextFollowUpDate?: string;
}

export function createFollowUp(dto: CreateFollowUpValues): Promise<{ data: FollowUp }> {
  return apiRequest('/follow-ups', { method: 'POST', body: dto });
}

export interface TransitionFollowUpValues {
  status: 'FOLLOW_UP_REQUIRED' | 'PROMISE_TO_PAY' | 'DISPUTED' | 'ESCALATED' | 'CLOSED';
  followUpDate: string;
  followUpType: FollowUpType;
  contactPerson?: string;
  discussionNotes?: string;
  customerResponse?: string;
  promiseAmount?: number;
  promisePaymentDate?: string;
  nextFollowUpDate?: string;
}

export function transitionFollowUp(
  id: string,
  dto: TransitionFollowUpValues,
): Promise<{ data: FollowUp }> {
  return apiRequest(`/follow-ups/${id}/transition`, { method: 'PATCH', body: dto });
}

export function reassignFollowUp(id: string, assignedToId: string): Promise<{ data: FollowUp }> {
  return apiRequest(`/follow-ups/${id}/reassign`, { method: 'PATCH', body: { assignedToId } });
}

export function bulkReassignByRoute(routeId: string, assignedToId: string) {
  return apiRequest('/follow-ups/bulk-reassign-route', {
    method: 'POST',
    body: { routeId, assignedToId },
  });
}
