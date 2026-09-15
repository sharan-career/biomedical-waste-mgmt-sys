import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationProviderRegistry } from './providers/notification-provider.registry';
import { RemindersService } from './reminders.service';

describe('RemindersService', () => {
  let service: RemindersService;
  let prisma: {
    reminderRule: {
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    reminderLog: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
    invoice: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditService: { record: jest.Mock };
  let providerRegistry: { get: jest.Mock };
  let sendMock: jest.Mock;

  const today = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const daysFromToday = (n: number) => {
    const d = today();
    d.setDate(d.getDate() + n);
    return d;
  };

  beforeEach(() => {
    prisma = {
      reminderRule: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      reminderLog: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      invoice: { findMany: jest.fn() },
      $transaction: jest.fn((callback) => callback(prisma)),
    };
    auditService = { record: jest.fn() };
    sendMock = jest.fn().mockResolvedValue({ success: true });
    providerRegistry = { get: jest.fn().mockReturnValue({ send: sendMock }) };

    service = new RemindersService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      providerRegistry as unknown as NotificationProviderRegistry,
    );
  });

  describe('createRule / updateRule', () => {
    it('records an audit entry on create', async () => {
      prisma.reminderRule.create.mockResolvedValue({
        id: 'rule-1',
        name: 'x',
        channel: 'SMS',
      });
      await service.createRule(
        {
          name: 'x',
          triggerType: 'DAYS_AFTER_DUE',
          triggerOffsetDays: 3,
          channel: 'SMS',
          messageTemplate: 'hi',
        },
        'actor-1',
      );
      expect(auditService.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ action: 'REMINDER_RULE_CREATED' }),
      );
    });

    it('rejects updating an unknown rule', async () => {
      prisma.reminderRule.findUnique.mockResolvedValue(null);
      await expect(
        service.updateRule('missing', { active: false }, 'actor-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('evaluateAndSend', () => {
    const rule = {
      id: 'rule-1',
      triggerType: 'DAYS_AFTER_DUE',
      triggerOffsetDays: 3,
      channel: 'SMS',
      messageTemplate:
        'Dear {{customerName}}, invoice {{invoiceNumber}} for {{amount}} is overdue.',
    };

    it('sends a reminder for an invoice past its trigger date with no prior log', async () => {
      prisma.reminderRule.findMany.mockResolvedValue([rule]);
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          customerId: 'cust-1',
          invoiceNumber: 'INV-1',
          dueDate: daysFromToday(-3),
          outstandingAmount: '500',
          customer: {
            organizationName: 'Test Clinic',
            contacts: [
              { contactType: 'PRIMARY', phone: '9999999999', email: null },
            ],
          },
          followUps: [],
        },
      ]);
      prisma.reminderLog.findUnique.mockResolvedValue(null);

      const result = await service.evaluateAndSend();

      expect(result.sent).toBe(1);
      expect(sendMock).toHaveBeenCalledWith(
        '9999999999',
        expect.stringContaining('Test Clinic'),
      );
      expect(prisma.reminderLog.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ruleId_invoiceId: { ruleId: 'rule-1', invoiceId: 'inv-1' } },
          create: expect.objectContaining({
            deliveryStatus: 'SENT',
            retryCount: 0,
          }),
        }),
      );
    });

    it('does not fire a rule before its trigger date arrives', async () => {
      prisma.reminderRule.findMany.mockResolvedValue([rule]);
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          customerId: 'cust-1',
          invoiceNumber: 'INV-1',
          dueDate: daysFromToday(1), // due tomorrow, rule fires 3 days AFTER due
          outstandingAmount: '500',
          customer: { organizationName: 'Test Clinic', contacts: [] },
          followUps: [],
        },
      ]);

      const result = await service.evaluateAndSend();

      expect(result.sent).toBe(0);
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('never re-fires a rule that already succeeded for this invoice', async () => {
      prisma.reminderRule.findMany.mockResolvedValue([rule]);
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          customerId: 'cust-1',
          invoiceNumber: 'INV-1',
          dueDate: daysFromToday(-3),
          outstandingAmount: '500',
          customer: { organizationName: 'Test Clinic', contacts: [] },
          followUps: [],
        },
      ]);
      prisma.reminderLog.findUnique.mockResolvedValue({
        deliveryStatus: 'SENT',
        retryCount: 0,
      });

      const result = await service.evaluateAndSend();

      expect(result.sent).toBe(0);
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('stops retrying once MAX_RETRIES is reached', async () => {
      prisma.reminderRule.findMany.mockResolvedValue([rule]);
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          customerId: 'cust-1',
          invoiceNumber: 'INV-1',
          dueDate: daysFromToday(-3),
          outstandingAmount: '500',
          customer: { organizationName: 'Test Clinic', contacts: [] },
          followUps: [],
        },
      ]);
      prisma.reminderLog.findUnique.mockResolvedValue({
        deliveryStatus: 'FAILED',
        retryCount: 2,
      });

      const result = await service.evaluateAndSend();

      expect(sendMock).not.toHaveBeenCalled();
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('pauses reminders while the invoice has an active DISPUTED follow-up', async () => {
      prisma.reminderRule.findMany.mockResolvedValue([rule]);
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          customerId: 'cust-1',
          invoiceNumber: 'INV-1',
          dueDate: daysFromToday(-3),
          outstandingAmount: '500',
          customer: { organizationName: 'Test Clinic', contacts: [] },
          followUps: [{ status: 'DISPUTED' }],
        },
      ]);

      const result = await service.evaluateAndSend();

      expect(sendMock).not.toHaveBeenCalled();
      expect(result.skippedDisputed).toBe(1);
    });

    it('marks FAILED when the customer has no contact info for the channel', async () => {
      prisma.reminderRule.findMany.mockResolvedValue([rule]);
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          customerId: 'cust-1',
          invoiceNumber: 'INV-1',
          dueDate: daysFromToday(-3),
          outstandingAmount: '500',
          customer: { organizationName: 'Test Clinic', contacts: [] },
          followUps: [],
        },
      ]);
      prisma.reminderLog.findUnique.mockResolvedValue(null);

      const result = await service.evaluateAndSend();

      expect(result.failed).toBe(1);
      expect(sendMock).not.toHaveBeenCalled();
      expect(prisma.reminderLog.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ deliveryStatus: 'FAILED' }),
        }),
      );
    });
  });
});
