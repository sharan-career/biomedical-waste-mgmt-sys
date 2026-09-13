import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InvoicesService } from './invoices.service';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: {
    contract: { findUnique: jest.Mock };
    invoice: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    invoiceSequence: { upsert: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditService: { record: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(() => {
    prisma = {
      contract: { findUnique: jest.fn() },
      invoice: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      invoiceSequence: { upsert: jest.fn() },
      $transaction: jest.fn((callback) => callback(prisma)),
    };
    auditService = { record: jest.fn() };
    configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, string> = { INVOICE_NUMBER_PREFIX: 'PAG' };
        return values[key] ?? fallback;
      }),
    };

    service = new InvoicesService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      configService as unknown as ConfigService,
    );
  });

  describe('generate', () => {
    it('rejects an unknown contract', async () => {
      prisma.contract.findUnique.mockResolvedValue(null);
      await expect(
        service.generate(
          {
            contractId: 'c1',
            billingPeriodStart: '2026-08-01',
            billingPeriodEnd: '2026-08-31',
          },
          'actor-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a contract with no active rate card', async () => {
      prisma.contract.findUnique.mockResolvedValue({
        id: 'c1',
        status: 'DRAFT',
        activeRateCard: null,
        customer: { bedCount: null, paymentTermsDays: 30 },
      });
      await expect(
        service.generate(
          {
            contractId: 'c1',
            billingPeriodStart: '2026-08-01',
            billingPeriodEnd: '2026-08-31',
          },
          'actor-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('computes a flat 600 fixed-fee clinic invoice matching the real bill sample (5% GST)', async () => {
      prisma.contract.findUnique.mockResolvedValue({
        id: 'c1',
        customerId: 'cust-1',
        status: 'ACTIVE',
        paymentTermsDays: null,
        customer: { bedCount: null, paymentTermsDays: 30 },
        activeRateCard: {
          components: [
            {
              componentType: 'FIXED_FEE',
              unitAmount: '600.00',
              taxable: true,
              cgstRatePercent: '2.5',
              sgstRatePercent: '2.5',
            },
          ],
        },
      });
      prisma.invoiceSequence.upsert.mockResolvedValue({ lastNumber: 2193 });
      prisma.invoice.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'inv-1', ...data }),
      );

      const result = await service.generate(
        {
          contractId: 'c1',
          billingPeriodStart: '2026-08-01',
          billingPeriodEnd: '2026-08-31',
        },
        'actor-1',
      );

      expect(result.invoiceNumber).toBe('PAG/26-27/2193');
      expect(result.totalAmount.toString()).toBe('600');
      // 600 / 1.05 = 571.428... rounds to 571.43
      expect(result.subtotal.toString()).toBe('571.43');
      // 571.43 * 2.5% = 14.29 each side => 28.58 total tax
      expect(result.taxAmount.toString()).toBe('28.58');
    });

    it('multiplies a PER_BED component by the customer bed count', async () => {
      prisma.contract.findUnique.mockResolvedValue({
        id: 'c1',
        customerId: 'cust-1',
        status: 'ACTIVE',
        paymentTermsDays: null,
        customer: { bedCount: 30, paymentTermsDays: 30 },
        activeRateCard: {
          components: [
            {
              componentType: 'PER_BED',
              unitAmount: '180.71',
              taxable: true,
              cgstRatePercent: '2.5',
              sgstRatePercent: '2.5',
            },
          ],
        },
      });
      prisma.invoiceSequence.upsert.mockResolvedValue({ lastNumber: 2194 });
      prisma.invoice.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'inv-2', ...data }),
      );

      const result = await service.generate(
        {
          contractId: 'c1',
          billingPeriodStart: '2026-08-01',
          billingPeriodEnd: '2026-08-31',
        },
        'actor-1',
      );

      // 30 beds * 180.71 = 5421.30 (tax-inclusive total, close to the real Aditi Hospital bill)
      expect(result.totalAmount.toString()).toBe('5421.3');
    });

    it('leaves a non-taxable component untaxed', async () => {
      prisma.contract.findUnique.mockResolvedValue({
        id: 'c1',
        customerId: 'cust-1',
        status: 'ACTIVE',
        paymentTermsDays: null,
        customer: { bedCount: null, paymentTermsDays: 30 },
        activeRateCard: {
          components: [
            {
              componentType: 'DISCOUNT',
              unitAmount: '-50',
              taxable: false,
              cgstRatePercent: '0',
              sgstRatePercent: '0',
            },
          ],
        },
      });
      prisma.invoiceSequence.upsert.mockResolvedValue({ lastNumber: 2195 });
      prisma.invoice.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'inv-3', ...data }),
      );

      const result = await service.generate(
        {
          contractId: 'c1',
          billingPeriodStart: '2026-08-01',
          billingPeriodEnd: '2026-08-31',
        },
        'actor-1',
      );

      expect(result.taxAmount.toString()).toBe('0');
      expect(result.totalAmount.toString()).toBe('-50');
    });
  });

  describe('approve / markSent / cancel lifecycle', () => {
    it('rejects approving a non-DRAFT invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'APPROVED',
      });
      await expect(service.approve('inv-1', 'actor-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects marking a non-APPROVED invoice as sent', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'DRAFT',
      });
      await expect(service.markSent('inv-1', 'actor-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects cancelling an already-cancelled invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'CANCELLED',
      });
      await expect(
        service.cancel('inv-1', { reason: 'dup' }, 'actor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('approves a DRAFT invoice and records an audit entry', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'DRAFT',
      });
      prisma.invoice.update.mockResolvedValue({
        id: 'inv-1',
        status: 'APPROVED',
      });

      await service.approve('inv-1', 'actor-1');

      expect(auditService.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ action: 'INVOICE_APPROVED' }),
      );
    });
  });
});
