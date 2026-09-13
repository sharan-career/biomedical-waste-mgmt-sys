import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: {
    customer: { findFirst: jest.Mock };
    invoice: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
    payment: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    paymentAllocation: {
      aggregate: jest.Mock;
      groupBy: jest.Mock;
      create: jest.Mock;
    };
    creditNote: { aggregate: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditService: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      customer: { findFirst: jest.fn() },
      invoice: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      paymentAllocation: {
        aggregate: jest.fn(),
        groupBy: jest.fn(),
        create: jest.fn(),
      },
      creditNote: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { amount: new Decimal(0) } }),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };
    auditService = { record: jest.fn() };

    service = new PaymentsService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );
  });

  describe('record', () => {
    const baseDto = {
      customerId: 'cust-1',
      amount: 100,
      paymentMode: 'CASH' as const,
      paymentDate: '2026-09-01',
    };

    it('rejects an unknown customer', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      await expect(service.record(baseDto, 'actor-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects allocations that exceed the payment amount', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      await expect(
        service.record(
          { ...baseDto, allocations: [{ invoiceId: 'inv-1', amount: 200 }] },
          'actor-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects allocating to an invoice not in a payable state', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          customerId: 'cust-1',
          status: 'DRAFT',
          outstandingAmount: '100',
        },
      ]);
      await expect(
        service.record(
          { ...baseDto, allocations: [{ invoiceId: 'inv-1', amount: 50 }] },
          'actor-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an allocation exceeding the invoice outstanding balance', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          customerId: 'cust-1',
          status: 'SENT',
          invoiceNumber: 'INV-1',
          outstandingAmount: '30',
        },
      ]);
      await expect(
        service.record(
          { ...baseDto, allocations: [{ invoiceId: 'inv-1', amount: 50 }] },
          'actor-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('splits one payment across two invoices and creates unallocated credit for the remainder', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          customerId: 'cust-1',
          status: 'SENT',
          invoiceNumber: 'INV-1',
          outstandingAmount: '60',
        },
        {
          id: 'inv-2',
          customerId: 'cust-1',
          status: 'SENT',
          invoiceNumber: 'INV-2',
          outstandingAmount: '30',
        },
      ]);
      prisma.payment.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'pay-1', ...data }),
      );
      prisma.paymentAllocation.aggregate.mockResolvedValue({
        _sum: { allocatedAmount: '60' },
      });
      prisma.invoice.findUniqueOrThrow.mockResolvedValue({
        id: 'inv-1',
        status: 'SENT',
        totalAmount: '60',
      });
      prisma.invoice.update.mockResolvedValue({ id: 'inv-1', status: 'PAID' });

      const result = await service.record(
        {
          ...baseDto,
          amount: 100,
          allocations: [
            { invoiceId: 'inv-1', amount: 60 },
            { invoiceId: 'inv-2', amount: 30 },
          ],
        },
        'actor-1',
      );

      expect(result.id).toBe('pay-1');
      const createCall = prisma.payment.create.mock.calls[0][0];
      const allocationRows = createCall.data.allocations.create;
      expect(allocationRows).toEqual(
        expect.arrayContaining([
          { invoiceId: 'inv-1', allocatedAmount: 60 },
          { invoiceId: 'inv-2', allocatedAmount: 30 },
        ]),
      );
      const creditRow = allocationRows.find(
        (r: { invoiceId: string | null }) => r.invoiceId === null,
      );
      expect(creditRow.allocatedAmount.toString()).toBe('10');
    });
  });

  describe('reverse', () => {
    it('rejects reversing an already-reversed payment', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        status: 'REVERSED',
        allocations: [],
      });
      await expect(
        service.reverse('pay-1', { reason: 'oops' }, 'actor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a reversal payment with negated allocations and marks the original REVERSED', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        status: 'RECORDED',
        customerId: 'cust-1',
        amount: '100',
        paymentMode: 'CASH',
        allocations: [{ invoiceId: 'inv-1', allocatedAmount: '60' }],
      });
      prisma.payment.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'pay-2', ...data }),
      );
      prisma.paymentAllocation.aggregate.mockResolvedValue({
        _sum: { allocatedAmount: '0' },
      });
      prisma.invoice.findUniqueOrThrow.mockResolvedValue({
        id: 'inv-1',
        status: 'PARTIALLY_PAID',
        totalAmount: '60',
      });
      prisma.invoice.update.mockResolvedValue({ id: 'inv-1', status: 'SENT' });

      await service.reverse('pay-1', { reason: 'bounced cheque' }, 'actor-1');

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-1' },
          data: expect.objectContaining({ status: 'REVERSED' }),
        }),
      );
      const reversalAllocations =
        prisma.payment.create.mock.calls[0][0].data.allocations.create;
      expect(reversalAllocations[0].invoiceId).toBe('inv-1');
      expect(reversalAllocations[0].allocatedAmount.toString()).toBe('-60');
      // Invoice reverts to SENT once fully un-paid by the reversal.
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SENT' }),
        }),
      );
    });
  });

  describe('getCreditBalance', () => {
    it('sums unallocated PaymentAllocation rows for the customer', async () => {
      prisma.paymentAllocation.aggregate.mockResolvedValue({
        _sum: { allocatedAmount: new Decimal('250.50') },
      });
      const result = await service.getCreditBalance('cust-1');
      expect(result.availableCredit).toBe('250.5');
    });
  });

  describe('applyCredit', () => {
    it('rejects when the customer has insufficient credit', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        customerId: 'cust-1',
        status: 'SENT',
        outstandingAmount: '100',
      });
      prisma.paymentAllocation.groupBy.mockResolvedValue([
        { paymentId: 'pay-1', _sum: { allocatedAmount: '20' } },
      ]);
      prisma.payment.findMany.mockResolvedValue([
        { id: 'pay-1', createdAt: new Date() },
      ]);

      await expect(
        service.applyCredit(
          'cust-1',
          { invoiceId: 'inv-1', amount: 50 },
          'actor-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('draws down credit FIFO across multiple payments to fully cover the request', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        customerId: 'cust-1',
        status: 'SENT',
        outstandingAmount: '100',
      });
      prisma.paymentAllocation.groupBy.mockResolvedValue([
        { paymentId: 'pay-old', _sum: { allocatedAmount: '30' } },
        { paymentId: 'pay-new', _sum: { allocatedAmount: '50' } },
      ]);
      prisma.payment.findMany.mockResolvedValue([
        { id: 'pay-old', createdAt: new Date('2026-01-01') },
        { id: 'pay-new', createdAt: new Date('2026-02-01') },
      ]);
      prisma.paymentAllocation.aggregate.mockResolvedValue({
        _sum: { allocatedAmount: '40' },
      });
      prisma.invoice.findUniqueOrThrow.mockResolvedValue({
        id: 'inv-1',
        status: 'SENT',
        totalAmount: '100',
      });
      prisma.invoice.update.mockResolvedValue({
        id: 'inv-1',
        status: 'PARTIALLY_PAID',
      });

      await service.applyCredit(
        'cust-1',
        { invoiceId: 'inv-1', amount: 40 },
        'actor-1',
      );

      // Draws all 30 from the oldest payment first, then 10 from the newer one.
      const createCalls = prisma.paymentAllocation.create.mock.calls.map(
        (c) => c[0].data,
      );
      expect(createCalls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ paymentId: 'pay-old', invoiceId: 'inv-1' }),
          expect.objectContaining({ paymentId: 'pay-new', invoiceId: 'inv-1' }),
        ]),
      );
    });
  });

  describe('getAgingReport', () => {
    it('buckets invoices by days past due', async () => {
      const today = new Date();
      const daysAgo = (n: number) =>
        new Date(today.getTime() - n * 24 * 60 * 60 * 1000);

      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-current',
          invoiceNumber: 'INV-1',
          customer: { id: 'c1' },
          dueDate: daysAgo(-5),
          outstandingAmount: '100',
        },
        {
          id: 'inv-45',
          invoiceNumber: 'INV-2',
          customer: { id: 'c1' },
          dueDate: daysAgo(45),
          outstandingAmount: '200',
        },
        {
          id: 'inv-120',
          invoiceNumber: 'INV-3',
          customer: { id: 'c1' },
          dueDate: daysAgo(120),
          outstandingAmount: '300',
        },
      ]);

      const report = await service.getAgingReport();

      expect(report.buckets.current).toBe('100');
      expect(report.buckets.days31To60).toBe('200');
      expect(report.buckets.days90Plus).toBe('300');
    });
  });
});
