import { apiRequest } from './api-client';
import type { AgingReport, Paginated, Payment, PaymentMode, PaymentStatus } from './types';

export interface PaymentListParams {
  page?: number;
  limit?: number;
  customerId?: string;
  status?: PaymentStatus;
}

function buildQueryString<T extends object>(params: T): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export interface RecordPaymentValues {
  customerId: string;
  amount: number;
  paymentMode: PaymentMode;
  paymentDate: string;
  referenceNumber?: string;
  bankDetails?: string;
  notes?: string;
  allocations?: { invoiceId: string; amount: number }[];
}

export function recordPayment(dto: RecordPaymentValues): Promise<{ data: Payment }> {
  return apiRequest('/payments', { method: 'POST', body: dto });
}

export function listPayments(params: PaymentListParams): Promise<Paginated<Payment>> {
  return apiRequest(`/payments${buildQueryString(params)}`);
}

export function getPayment(id: string): Promise<{ data: Payment }> {
  return apiRequest(`/payments/${id}`);
}

export function reversePayment(id: string, reason: string): Promise<{ data: Payment }> {
  return apiRequest(`/payments/${id}/reverse`, { method: 'PATCH', body: { reason } });
}

export function getCreditBalance(
  customerId: string,
): Promise<{ data: { customerId: string; availableCredit: string } }> {
  return apiRequest(`/customers/${customerId}/credit-balance`);
}

export function applyCredit(customerId: string, invoiceId: string, amount: number) {
  return apiRequest(`/customers/${customerId}/apply-credit`, {
    method: 'POST',
    body: { invoiceId, amount },
  });
}

export function getAgingReport(customerId?: string): Promise<{ data: AgingReport }> {
  return apiRequest(`/payments/aging${buildQueryString({ customerId })}`);
}
