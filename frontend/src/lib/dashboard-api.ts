import { apiRequest } from './api-client';
import type { Invoice, Payment } from './types';

export interface DashboardSummary {
  cards: {
    totalOutstanding: string;
    totalOverdue: string;
    collectionThisMonth: string;
    dueThisWeek: string;
    overdue1To30: string;
    overdue31To60: string;
    overdue61To90: string;
    overdue90Plus: string;
  };
  topOverdueCustomers: { id: string; customerCode: string; organizationName: string; outstandingAmount: string }[];
  followUpsTodayCount: number;
  recentPayments: Payment[];
  recentInvoices: Invoice[];
}

export function getDashboardSummary(): Promise<{ data: DashboardSummary }> {
  return apiRequest('/dashboard/summary');
}
