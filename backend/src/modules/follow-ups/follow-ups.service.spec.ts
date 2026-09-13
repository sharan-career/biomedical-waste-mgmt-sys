import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FollowUpsService } from './follow-ups.service';

describe('FollowUpsService', () => {
  let service: FollowUpsService;
  let prisma: {
    customer: { findFirst: jest.Mock };
    invoice: { findFirst: jest.Mock; findMany: jest.Mock };
    user: { findFirst: jest.Mock };
    followUp: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let auditService: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      customer: { findFirst: jest.fn() },
      invoice: { findFirst: jest.fn(), findMany: jest.fn() },
      user: { findFirst: jest.fn() },
      followUp: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };
    auditService = { record: jest.fn() };

    service = new FollowUpsService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );
  });

  describe('create', () => {
    const baseDto = {
      customerId: 'cust-1',
      assignedToId: 'user-1',
      followUpDate: '2026-09-13',
      followUpType: 'PHONE_CALL' as const,
    };

    it('rejects an unknown customer', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      await expect(service.create(baseDto, 'actor-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects an unknown or inactive assignee', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.create(baseDto, 'actor-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates an OPEN follow-up and records an audit entry', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        status: 'ACTIVE',
      });
      prisma.followUp.create.mockResolvedValue({ id: 'fu-1', status: 'OPEN' });

      const result = await service.create(baseDto, 'actor-1');

      expect(result.id).toBe('fu-1');
      expect(auditService.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ action: 'FOLLOW_UP_CREATED' }),
      );
    });
  });

  describe('transition', () => {
    it('rejects transitioning an already-closed follow-up', async () => {
      prisma.followUp.findUnique.mockResolvedValue({
        id: 'fu-1',
        status: 'CLOSED',
      });
      await expect(
        service.transition(
          'fu-1',
          {
            status: 'FOLLOW_UP_REQUIRED',
            followUpDate: '2026-09-13',
            followUpType: 'PHONE_CALL',
          },
          'actor-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a new row chained via previousFollowUpId, leaving the old row untouched', async () => {
      prisma.followUp.findUnique.mockResolvedValue({
        id: 'fu-1',
        customerId: 'cust-1',
        invoiceId: 'inv-1',
        assignedToId: 'user-1',
        status: 'OPEN',
      });
      prisma.followUp.create.mockResolvedValue({
        id: 'fu-2',
        status: 'PROMISE_TO_PAY',
      });

      await service.transition(
        'fu-1',
        {
          status: 'PROMISE_TO_PAY',
          followUpDate: '2026-09-13',
          followUpType: 'PHONE_CALL',
          promiseAmount: 5000,
          promisePaymentDate: '2026-09-20',
        },
        'actor-1',
      );

      expect(prisma.followUp.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            previousFollowUpId: 'fu-1',
            customerId: 'cust-1',
            invoiceId: 'inv-1',
            assignedToId: 'user-1',
            status: 'PROMISE_TO_PAY',
          }),
        }),
      );
      // The original row is never updated/mutated.
      expect(prisma.followUp.update).not.toHaveBeenCalled();
    });
  });

  describe('reassign', () => {
    it('rejects reassigning a closed follow-up', async () => {
      prisma.followUp.findUnique.mockResolvedValue({
        id: 'fu-1',
        status: 'CLOSED',
      });
      await expect(
        service.reassign('fu-1', { assignedToId: 'user-2' }, 'actor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('mutates assignedToId in place and captures previousAssignedToId', async () => {
      prisma.followUp.findUnique.mockResolvedValue({
        id: 'fu-1',
        status: 'OPEN',
        assignedToId: 'user-1',
      });
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-2',
        status: 'ACTIVE',
      });
      prisma.followUp.update.mockResolvedValue({
        id: 'fu-1',
        assignedToId: 'user-2',
      });

      await service.reassign('fu-1', { assignedToId: 'user-2' }, 'actor-1');

      expect(prisma.followUp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'fu-1' },
          data: expect.objectContaining({
            previousAssignedToId: 'user-1',
            assignedToId: 'user-2',
          }),
        }),
      );
    });
  });

  describe('runOverdueInvoiceCheck', () => {
    it('creates a follow-up for an overdue invoice whose customer has a route executive', async () => {
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          invoiceNumber: 'INV-1',
          customerId: 'cust-1',
          customer: { route: { assignedExecutiveId: 'exec-1' } },
        },
      ]);
      prisma.followUp.create.mockResolvedValue({ id: 'fu-auto' });

      const result = await service.runOverdueInvoiceCheck();

      expect(result).toEqual({ created: 1, skipped: 0 });
      expect(prisma.followUp.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignedToId: 'exec-1',
            isSystemGenerated: true,
          }),
        }),
      );
    });

    it('skips a customer with no route executive assigned', async () => {
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          invoiceNumber: 'INV-1',
          customerId: 'cust-1',
          customer: { route: null },
        },
      ]);

      const result = await service.runOverdueInvoiceCheck();

      expect(result).toEqual({ created: 0, skipped: 1 });
      expect(prisma.followUp.create).not.toHaveBeenCalled();
    });
  });

  describe('runBrokenPromiseCheck', () => {
    it('flags a broken promise when the invoice is still unpaid', async () => {
      prisma.followUp.findMany.mockResolvedValue([
        {
          id: 'fu-1',
          customerId: 'cust-1',
          invoiceId: 'inv-1',
          assignedToId: 'user-1',
          followUpType: 'PHONE_CALL',
          promiseAmount: 5000,
          promisePaymentDate: new Date('2026-09-01'),
          invoice: { status: 'PARTIALLY_PAID' },
        },
      ]);
      prisma.followUp.create.mockResolvedValue({ id: 'fu-2' });

      const result = await service.runBrokenPromiseCheck();

      expect(result).toEqual({ flagged: 1 });
      expect(prisma.followUp.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FOLLOW_UP_REQUIRED',
            previousFollowUpId: 'fu-1',
            isSystemGenerated: true,
          }),
        }),
      );
    });

    it('skips a promise whose invoice was actually paid in full', async () => {
      prisma.followUp.findMany.mockResolvedValue([
        {
          id: 'fu-1',
          invoiceId: 'inv-1',
          invoice: { status: 'PAID' },
        },
      ]);

      const result = await service.runBrokenPromiseCheck();

      expect(result).toEqual({ flagged: 0 });
      expect(prisma.followUp.create).not.toHaveBeenCalled();
    });
  });
});
