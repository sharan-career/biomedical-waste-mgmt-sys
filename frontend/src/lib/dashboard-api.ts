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
  facilityTypeBreakdown: { facilityType: string; count: number }[];
  talukaAgingBreakdown: {
    taluka: string;
    current: string;
    days1To30: string;
    days31To60: string;
    days61To90: string;
    days90Plus: string;
  }[];
  monthlyCollectionTrend: { month: string; totalCollected: string }[];
}

export function getDashboardSummary(): Promise<{ data: DashboardSummary }> {
  return apiRequest('/dashboard/summary');
}
