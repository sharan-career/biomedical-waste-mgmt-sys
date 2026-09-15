import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { ReportQueryDto } from './dto/report-query.dto';

const PAYABLE_STATUSES = ['SENT', 'PARTIALLY_PAID'] as const;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async customerOutstanding(query: ReportQueryDto) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: [...PAYABLE_STATUSES] },
        ...(query.customerId ? { customerId: query.customerId } : {}),
      },
      include: { customer: { include: { taluka: true } } },
    });

    const byCustomer = new Map<
      string,
      {
        customerCode: string;
        organizationName: string;
        taluka: string;
        invoiceCount: number;
        totalOutstanding: Decimal;
      }
    >();
    for (const invoice of invoices) {
      const key = invoice.customerId;
      const existing = byCustomer.get(key);
      const amount = new Decimal(invoice.outstandingAmount.toString());
      if (existing) {
        existing.invoiceCount += 1;
        existing.totalOutstanding = existing.totalOutstanding.plus(amount);
      } else {
        byCustomer.set(key, {
          customerCode: invoice.customer.customerCode,
          organizationName: invoice.customer.organizationName,
          taluka: invoice.customer.taluka.name,
          invoiceCount: 1,
          totalOutstanding: amount,
        });
      }
    }

    return [...byCustomer.values()]
      .map((row) => ({
        ...row,
        totalOutstanding: row.totalOutstanding.toString(),
      }))
      .sort((a, b) => Number(b.totalOutstanding) - Number(a.totalOutstanding));
  }

  async invoiceReport(query: ReportQueryDto) {
    const where: Prisma.InvoiceWhereInput = {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.startDate || query.endDate
        ? {
            invoiceDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { customerCode: true, organizationName: true } },
      },
      orderBy: { invoiceDate: 'desc' },
    });

    return invoices.map((invoice) => ({
      invoiceNumber: invoice.invoiceNumber,
      customerCode: invoice.customer.customerCode,
      organizationName: invoice.customer.organizationName,
      invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
      dueDate: invoice.dueDate.toISOString().slice(0, 10),
      totalAmount: invoice.totalAmount.toString(),
      paidAmount: invoice.paidAmount.toString(),
      outstandingAmount: invoice.outstandingAmount.toString(),
      status: invoice.status,
    }));
  }

  async paymentCollectionReport(query: ReportQueryDto) {
    const where: Prisma.PaymentWhereInput = {
      status: 'RECORDED',
      reversalOfPaymentId: null,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.startDate || query.endDate
        ? {
            paymentDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        customer: { select: { customerCode: true, organizationName: true } },
      },
      orderBy: { paymentDate: 'desc' },
    });

    return payments.map((payment) => ({
      paymentDate: payment.paymentDate.toISOString().slice(0, 10),
      customerCode: payment.customer.customerCode,
      organizationName: payment.customer.organizationName,
      amount: payment.amount.toString(),
      paymentMode: payment.paymentMode,
      referenceNumber: payment.referenceNumber ?? '',
    }));
  }

  async overdueReport(query: ReportQueryDto) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: [...PAYABLE_STATUSES] },
        dueDate: { lt: today },
        ...(query.customerId ? { customerId: query.customerId } : {}),
      },
      include: {
        customer: { select: { customerCode: true, organizationName: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    return invoices.map((invoice) => ({
      invoiceNumber: invoice.invoiceNumber,
      customerCode: invoice.customer.customerCode,
      organizationName: invoice.customer.organizationName,
      dueDate: invoice.dueDate.toISOString().slice(0, 10),
      daysOverdue: Math.floor(
        (today.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24),
      ),
      outstandingAmount: invoice.outstandingAmount.toString(),
    }));
  }

  agingReport(query: ReportQueryDto) {
    return this.paymentsService.getAgingReport(query.customerId);
  }

  async collectionExecutivePerformance(query: ReportQueryDto) {
    const dateFilter =
      query.startDate || query.endDate
        ? {
            followUpDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {};

    const executives = await this.prisma.user.findMany({
      where: { roles: { some: { role: { name: 'COLLECTION_EXECUTIVE' } } } },
    });

    return Promise.all(
      executives.map(async (executive) => {
        const [openCount, closedCount, brokenPromiseCount] = await Promise.all([
          this.prisma.followUp.count({
            where: {
              assignedToId: executive.id,
              status: { not: 'CLOSED' },
              nextFollowUp: null,
              ...dateFilter,
            },
          }),
          this.prisma.followUp.count({
            where: {
              assignedToId: executive.id,
              status: 'CLOSED',
              ...dateFilter,
            },
          }),
          this.prisma.followUp.count({
            where: {
              assignedToId: executive.id,
              isSystemGenerated: true,
              discussionNotes: { contains: 'Broken promise' },
              ...dateFilter,
            },
          }),
        ]);

        return {
          executiveName: executive.fullName,
          openFollowUps: openCount,
          closedFollowUps: closedCount,
          brokenPromises: brokenPromiseCount,
          totalFollowUps: openCount + closedCount,
        };
      }),
    );
  }

  async customerPaymentHistory(query: ReportQueryDto) {
    if (!query.customerId) {
      throw new BadRequestException(
        'customerId is required for the customer payment history report',
      );
    }

    const [invoices, payments, creditNotes] = await Promise.all([
      this.prisma.invoice.findMany({ where: { customerId: query.customerId } }),
      this.prisma.payment.findMany({
        where: { customerId: query.customerId, status: 'RECORDED' },
      }),
      this.prisma.creditNote.findMany({
        where: { customerId: query.customerId, status: 'APPLIED' },
      }),
    ]);

    const events = [
      ...invoices.map((i) => ({
        date: i.invoiceDate,
        type: 'INVOICE' as const,
        reference: i.invoiceNumber,
        amount: i.totalAmount.toString(),
      })),
      ...payments.map((p) => ({
        date: p.paymentDate,
        type: 'PAYMENT' as const,
        reference: p.referenceNumber ?? p.id,
        amount: p.amount.toString(),
      })),
      ...creditNotes.map((c) => ({
        date: c.updatedAt,
        type: 'CREDIT_NOTE' as const,
        reference: c.reason,
        amount: c.amount.toString(),
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    return events.map((e) => ({
      ...e,
      date: e.date.toISOString().slice(0, 10),
    }));
  }

  async monthlyCollectionReport(query: ReportQueryDto) {
    const where: Prisma.PaymentWhereInput = {
      status: 'RECORDED',
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.startDate || query.endDate
        ? {
            paymentDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const payments = await this.prisma.payment.findMany({ where });

    const byMonth = new Map<string, { total: Decimal; count: number }>();
    for (const payment of payments) {
      const monthKey = `${payment.paymentDate.getFullYear()}-${String(payment.paymentDate.getMonth() + 1).padStart(2, '0')}`;
      const existing = byMonth.get(monthKey) ?? {
        total: new Decimal(0),
        count: 0,
      };
      // Reversal "payments" carry the same positive amount as the original — net them out.
      const signedAmount = payment.reversalOfPaymentId
        ? new Decimal(payment.amount.toString()).negated()
        : new Decimal(payment.amount.toString());
      existing.total = existing.total.plus(signedAmount);
      existing.count += 1;
      byMonth.set(monthKey, existing);
    }

    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { total, count }]) => ({
        month,
        totalCollected: total.toString(),
        paymentCount: count,
      }));
  }
}
