import { apiRequest } from './api-client';
import type { CreditNote, Invoice, InvoiceStatus, OrgProfile, Paginated } from './types';

export interface InvoiceListParams {
  page?: number;
  limit?: number;
  customerId?: string;
  contractId?: string;
  status?: InvoiceStatus;
}

function buildQueryString(params: InvoiceListParams): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export interface GenerateInvoiceValues {
  contractId: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  invoiceDate?: string;
  notes?: string;
}

export function generateInvoice(dto: GenerateInvoiceValues): Promise<{ data: Invoice }> {
  return apiRequest('/billing/generate', { method: 'POST', body: dto });
}

export function listInvoices(params: InvoiceListParams): Promise<Paginated<Invoice>> {
  return apiRequest(`/invoices${buildQueryString(params)}`);
}

export function getInvoice(id: string): Promise<{ data: Invoice }> {
  return apiRequest(`/invoices/${id}`);
}

export function getOrgProfile(): Promise<{ data: OrgProfile }> {
  return apiRequest('/invoices/org-profile');
}

export function approveInvoice(id: string): Promise<{ data: Invoice }> {
  return apiRequest(`/invoices/${id}/approve`, { method: 'PATCH' });
}

export function sendInvoice(id: string): Promise<{ data: Invoice }> {
  return apiRequest(`/invoices/${id}/send`, { method: 'PATCH' });
}

export function cancelInvoice(id: string, reason: string): Promise<{ data: Invoice }> {
  return apiRequest(`/invoices/${id}/cancel`, { method: 'PATCH', body: { reason } });
}

export function listCreditNotes(invoiceId: string): Promise<{ data: CreditNote[] }> {
  return apiRequest(`/invoices/${invoiceId}/credit-notes`);
}

export function createCreditNote(
  invoiceId: string,
  dto: { reason: string; amount: number },
): Promise<{ data: CreditNote }> {
  return apiRequest(`/invoices/${invoiceId}/credit-notes`, { method: 'POST', body: dto });
}

export function approveCreditNote(id: string): Promise<{ data: CreditNote }> {
  return apiRequest(`/credit-notes/${id}/approve`, { method: 'PATCH' });
}

export function applyCreditNote(id: string): Promise<{ data: CreditNote }> {
  return apiRequest(`/credit-notes/${id}/apply`, { method: 'PATCH' });
}
