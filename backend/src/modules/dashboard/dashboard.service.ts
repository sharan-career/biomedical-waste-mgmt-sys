import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';

const PAYABLE_STATUSES = ['SENT', 'PARTIALLY_PAID'] as const;

interface TalukaAgingRow {
  taluka: string;
  current: Decimal;
  days1To30: Decimal;
  days31To60: Decimal;
  days61To90: Decimal;
  days90Plus: Decimal;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);

    const [
      outstandingInvoices,
      collectionAgg,
      followUpsToday,
      recentPayments,
      recentInvoices,
      facilityTypeCounts,
      recentPaymentsForTrend,
    ] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { status: { in: [...PAYABLE_STATUSES] } },
        select: {
          outstandingAmount: true,
          dueDate: true,
          customerId: true,
          customer: { select: { taluka: { select: { name: true } } } },
        },
      }),
      this.prisma.paymentAllocation.aggregate({
        where: {
          invoiceId: { not: null },
          payment: { paymentDate: { gte: monthStart } },
        },
        _sum: { allocatedAmount: true },
      }),
      this.prisma.followUp.count({
        where: {
          nextFollowUp: null,
          status: { not: 'CLOSED' },
          OR: [
            { nextFollowUpDate: { lte: today } },
            { status: 'PROMISE_TO_PAY', promisePaymentDate: { lte: today } },
          ],
        },
      }),
      this.prisma.payment.findMany({
        where: { status: 'RECORDED' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          customer: {
            select: { id: true, customerCode: true, organizationName: true },
          },
        },
      }),
      this.prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          customer: {
            select: { id: true, customerCode: true, organizationName: true },
          },
        },
      }),
      this.prisma.customer.groupBy({
        by: ['facilityType'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.payment.findMany({
        where: { status: 'RECORDED', paymentDate: { gte: sixMonthsAgo } },
        select: { paymentDate: true, amount: true, reversalOfPaymentId: true },
      }),
    ]);

    let totalOutstanding = new Decimal(0);
    let totalOverdue = new Decimal(0);
    let dueThisWeek = new Decimal(0);
    const buckets = {
      overdue1To30: new Decimal(0),
      overdue31To60: new Decimal(0),
      overdue61To90: new Decimal(0),
      overdue90Plus: new Decimal(0),
    };
    const outstandingByCustomer = new Map<string, Decimal>();
    const byTaluka = new Map<string, TalukaAgingRow>();

    for (const invoice of outstandingInvoices) {
      const amount = new Decimal(invoice.outstandingAmount.toString());
      totalOutstanding = totalOutstanding.plus(amount);
      outstandingByCustomer.set(
        invoice.customerId,
        (outstandingByCustomer.get(invoice.customerId) ?? new Decimal(0)).plus(
          amount,
        ),
      );

      const talukaName = invoice.customer.taluka.name;
      const talukaRow = byTaluka.get(talukaName) ?? {
        taluka: talukaName,
        current: new Decimal(0),
        days1To30: new Decimal(0),
        days31To60: new Decimal(0),
        days61To90: new Decimal(0),
        days90Plus: new Decimal(0),
      };

      const daysPastDue = Math.floor(
        (today.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysPastDue > 0) {
        totalOverdue = totalOverdue.plus(amount);
        if (daysPastDue <= 30) {
          buckets.overdue1To30 = buckets.overdue1To30.plus(amount);
          talukaRow.days1To30 = talukaRow.days1To30.plus(amount);
        } else if (daysPastDue <= 60) {
          buckets.overdue31To60 = buckets.overdue31To60.plus(amount);
          talukaRow.days31To60 = talukaRow.days31To60.plus(amount);
        } else if (daysPastDue <= 90) {
          buckets.overdue61To90 = buckets.overdue61To90.plus(amount);
          talukaRow.days61To90 = talukaRow.days61To90.plus(amount);
        } else {
          buckets.overdue90Plus = buckets.overdue90Plus.plus(amount);
          talukaRow.days90Plus = talukaRow.days90Plus.plus(amount);
        }
      } else {
        talukaRow.current = talukaRow.current.plus(amount);
        if (invoice.dueDate <= weekFromNow)
          dueThisWeek = dueThisWeek.plus(amount);
      }
      byTaluka.set(talukaName, talukaRow);
    }

    const topOverdueCustomerIds = [...outstandingByCustomer.entries()]
      .sort((a, b) => b[1].comparedTo(a[1]))
      .slice(0, 5)
      .map(([customerId]) => customerId);
    const topOverdueCustomers = topOverdueCustomerIds.length
      ? await this.prisma.customer.findMany({
          where: { id: { in: topOverdueCustomerIds } },
          select: { id: true, customerCode: true, organizationName: true },
        })
      : [];

    const monthlyTrendMap = new Map<string, Decimal>();
    for (const payment of recentPaymentsForTrend) {
      const monthKey = `${payment.paymentDate.getFullYear()}-${String(payment.paymentDate.getMonth() + 1).padStart(2, '0')}`;
      const signedAmount = payment.reversalOfPaymentId
        ? new Decimal(payment.amount.toString()).negated()
        : new Decimal(payment.amount.toString());
      monthlyTrendMap.set(
        monthKey,
        (monthlyTrendMap.get(monthKey) ?? new Decimal(0)).plus(signedAmount),
      );
    }
    const monthlyCollectionTrend = [...monthlyTrendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, totalCollected: total.toString() }));

    return {
      cards: {
        totalOutstanding: totalOutstanding.toString(),
        totalOverdue: totalOverdue.toString(),
        collectionThisMonth: (
          collectionAgg._sum.allocatedAmount ?? new Decimal(0)
        ).toString(),
        dueThisWeek: dueThisWeek.toString(),
        overdue1To30: buckets.overdue1To30.toString(),
        overdue31To60: buckets.overdue31To60.toString(),
        overdue61To90: buckets.overdue61To90.toString(),
        overdue90Plus: buckets.overdue90Plus.toString(),
      },
      topOverdueCustomers: topOverdueCustomerIds
        .map((id) => {
          const customer = topOverdueCustomers.find((c) => c.id === id);
          return (
            customer && {
              ...customer,
              outstandingAmount: outstandingByCustomer.get(id)!.toString(),
            }
          );
        })
        .filter(Boolean),
      followUpsTodayCount: followUpsToday,
      recentPayments,
      recentInvoices,
      facilityTypeBreakdown: facilityTypeCounts.map((row) => ({
        facilityType: row.facilityType,
        count: row._count._all,
      })),
      talukaAgingBreakdown: [...byTaluka.values()].map((row) => ({
        taluka: row.taluka,
        current: row.current.toString(),
        days1To30: row.days1To30.toString(),
        days31To60: row.days31To60.toString(),
        days61To90: row.days61To90.toString(),
        days90Plus: row.days90Plus.toString(),
      })),
      monthlyCollectionTrend,
    };
  }
}
