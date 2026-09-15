import { apiRequest, getAccessToken } from './api-client';

export interface ReportQueryParams {
  customerId?: string;
  startDate?: string;
  endDate?: string;
}

function buildQueryString(params: ReportQueryParams): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, value);
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export const REPORT_TYPES = [
  { value: 'customer-outstanding', label: 'Customer Outstanding' },
  { value: 'invoices', label: 'Invoice Report' },
  { value: 'payments', label: 'Payment Collection Report' },
  { value: 'overdue', label: 'Overdue Report' },
  { value: 'aging', label: 'Aging Report' },
  { value: 'collection-executive-performance', label: 'Collection Executive Performance' },
  { value: 'customer-payment-history', label: 'Customer Payment History (requires Customer ID)' },
  { value: 'monthly-collection', label: 'Monthly Collection Report' },
] as const;

export type ReportType = (typeof REPORT_TYPES)[number]['value'];

export function fetchReport(reportType: ReportType, params: ReportQueryParams): Promise<{ data: unknown }> {
  return apiRequest(`/reports/${reportType}${buildQueryString(params)}`);
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';

/** CSV export needs the Authorization header, so a plain <a href> won't work — fetch as a
 * blob and trigger the browser's download via a temporary object URL instead. */
export async function downloadReportCsv(reportType: ReportType, params: ReportQueryParams): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/reports/${reportType}/export${buildQueryString(params)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error('Failed to export report');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${reportType}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
