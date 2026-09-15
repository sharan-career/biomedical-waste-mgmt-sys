import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    invoice: { findMany: jest.Mock };
    payment: { findMany: jest.Mock };
    creditNote: { findMany: jest.Mock };
    customer: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
    followUp: { count: jest.Mock };
  };
  let paymentsService: { getAgingReport: jest.Mock };

  beforeEach(() => {
    prisma = {
      invoice: { findMany: jest.fn() },
      payment: { findMany: jest.fn() },
      creditNote: { findMany: jest.fn() },
      customer: { findMany: jest.fn() },
      user: { findMany: jest.fn() },
      followUp: { count: jest.fn() },
    };
    paymentsService = { getAgingReport: jest.fn() };

    service = new ReportsService(
      prisma as unknown as PrismaService,
      paymentsService as unknown as PaymentsService,
    );
  });

  describe('customerOutstanding', () => {
    it('aggregates outstanding amounts per customer and sorts descending', async () => {
      prisma.invoice.findMany.mockResolvedValue([
        {
          customerId: 'c1',
          outstandingAmount: '100',
          customer: {
            customerCode: 'A',
            organizationName: 'A Org',
            taluka: { name: 'Kalaburagi' },
          },
        },
        {
          customerId: 'c1',
          outstandingAmount: '50',
          customer: {
            customerCode: 'A',
            organizationName: 'A Org',
            taluka: { name: 'Kalaburagi' },
          },
        },
        {
          customerId: 'c2',
          outstandingAmount: '500',
          customer: {
            customerCode: 'B',
            organizationName: 'B Org',
            taluka: { name: 'Sedam' },
          },
        },
      ]);

      const result = await service.customerOutstanding({});

      expect(result).toEqual([
        expect.objectContaining({
          customerCode: 'B',
          totalOutstanding: '500',
          invoiceCount: 1,
        }),
        expect.objectContaining({
          customerCode: 'A',
          totalOutstanding: '150',
          invoiceCount: 2,
        }),
      ]);
    });
  });

  describe('overdueReport', () => {
    it('computes days overdue relative to today', async () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      prisma.invoice.findMany.mockResolvedValue([
        {
          invoiceNumber: 'INV-1',
          dueDate: tenDaysAgo,
          outstandingAmount: '200',
          customer: { customerCode: 'A', organizationName: 'A Org' },
        },
      ]);

      const result = await service.overdueReport({});

      expect(result[0].daysOverdue).toBeGreaterThanOrEqual(9);
      expect(result[0].daysOverdue).toBeLessThanOrEqual(11);
    });
  });

  describe('customerPaymentHistory', () => {
    it('requires a customerId', async () => {
      await expect(service.customerPaymentHistory({})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('merges invoices, payments, and credit notes sorted by date descending', async () => {
      prisma.invoice.findMany.mockResolvedValue([
        {
          invoiceDate: new Date('2026-01-01'),
          invoiceNumber: 'INV-1',
          totalAmount: '600',
        },
      ]);
      prisma.payment.findMany.mockResolvedValue([
        {
          paymentDate: new Date('2026-02-01'),
          referenceNumber: 'REF-1',
          amount: '600',
          id: 'p1',
        },
      ]);
      prisma.creditNote.findMany.mockResolvedValue([
        { updatedAt: new Date('2026-01-15'), reason: 'Goodwill', amount: '50' },
      ]);

      const result = await service.customerPaymentHistory({ customerId: 'c1' });

      expect(result.map((r) => r.type)).toEqual([
        'PAYMENT',
        'CREDIT_NOTE',
        'INVOICE',
      ]);
    });
  });

  describe('monthlyCollectionReport', () => {
    it('nets out reversal payments from the month they occurred in', async () => {
      prisma.payment.findMany.mockResolvedValue([
        {
          paymentDate: new Date('2026-03-05'),
          amount: '1000',
          reversalOfPaymentId: null,
        },
        {
          paymentDate: new Date('2026-03-10'),
          amount: '1000',
          reversalOfPaymentId: 'orig-1',
        },
      ]);

      const result = await service.monthlyCollectionReport({});

      expect(result).toEqual([
        { month: '2026-03', totalCollected: '0', paymentCount: 2 },
      ]);
    });
  });
});
