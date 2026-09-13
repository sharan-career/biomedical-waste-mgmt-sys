import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ContractsService } from './contracts.service';

describe('ContractsService', () => {
  let service: ContractsService;
  let prisma: {
    contract: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    customer: { findFirst: jest.Mock };
    rateCard: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let auditService: { record: jest.Mock };

  const baseContractDto = {
    contractNumber: 'CT-0001',
    customerId: 'customer-1',
    startDate: '2026-01-01',
    billingFrequency: 'MONTHLY' as const,
  };

  beforeEach(() => {
    prisma = {
      contract: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      customer: { findFirst: jest.fn() },
      rateCard: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };
    auditService = { record: jest.fn() };

    service = new ContractsService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );
  });

  describe('create', () => {
    it('rejects a duplicate contract number', async () => {
      prisma.contract.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.create(baseContractDto, 'actor-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects an unknown customer', async () => {
      prisma.contract.findUnique.mockResolvedValue(null);
      prisma.customer.findFirst.mockResolvedValue(null);
      await expect(service.create(baseContractDto, 'actor-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates a DRAFT contract and records an audit entry', async () => {
      prisma.contract.findUnique.mockResolvedValue(null);
      prisma.customer.findFirst.mockResolvedValue({ id: 'customer-1' });
      prisma.contract.create.mockResolvedValue({
        id: 'contract-1',
        contractNumber: 'CT-0001',
        customerId: 'customer-1',
      });

      const result = await service.create(baseContractDto, 'actor-1');

      expect(result.id).toBe('contract-1');
      expect(auditService.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ action: 'CONTRACT_CREATED' }),
      );
    });
  });

  describe('updateStatus', () => {
    it('rejects transitioning an already-terminated contract', async () => {
      prisma.contract.findUnique.mockResolvedValue({
        id: 'contract-1',
        status: 'TERMINATED',
      });
      await expect(
        service.updateStatus('contract-1', 'EXPIRED', 'actor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('records a CONTRACT_STATUS_CHANGED audit entry on a valid transition', async () => {
      prisma.contract.findUnique.mockResolvedValue({
        id: 'contract-1',
        status: 'ACTIVE',
      });
      prisma.contract.update.mockResolvedValue({
        id: 'contract-1',
        status: 'TERMINATED',
      });

      await service.updateStatus('contract-1', 'TERMINATED', 'actor-1');

      expect(auditService.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          action: 'CONTRACT_STATUS_CHANGED',
          previousValue: { status: 'ACTIVE' },
          newValue: { status: 'TERMINATED' },
        }),
      );
    });
  });

  describe('activateRateCard', () => {
    const contract = {
      id: 'contract-1',
      customerId: 'customer-1',
      status: 'DRAFT',
      activeRateCardId: null,
    };

    it('rejects activating a rate card on a terminated contract', async () => {
      prisma.contract.findUnique.mockResolvedValue({
        ...contract,
        status: 'TERMINATED',
      });
      await expect(
        service.activateRateCard(
          'contract-1',
          { rateCardId: 'rc-1' },
          'actor-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a rate card belonging to a different customer', async () => {
      prisma.contract.findUnique.mockResolvedValue(contract);
      prisma.rateCard.findUnique.mockResolvedValue({
        id: 'rc-1',
        customerId: 'other-customer',
        status: 'DRAFT',
        components: [{ id: 'comp-1' }],
      });

      await expect(
        service.activateRateCard(
          'contract-1',
          { rateCardId: 'rc-1' },
          'actor-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a rate card with no components', async () => {
      prisma.contract.findUnique.mockResolvedValue(contract);
      prisma.rateCard.findUnique.mockResolvedValue({
        id: 'rc-1',
        customerId: 'customer-1',
        status: 'DRAFT',
        components: [],
      });

      await expect(
        service.activateRateCard(
          'contract-1',
          { rateCardId: 'rc-1' },
          'actor-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('activates a valid draft rate card and sets the contract ACTIVE', async () => {
      prisma.contract.findUnique.mockResolvedValue(contract);
      prisma.rateCard.findUnique.mockResolvedValue({
        id: 'rc-1',
        customerId: 'customer-1',
        status: 'DRAFT',
        components: [{ id: 'comp-1' }],
      });
      prisma.contract.update.mockResolvedValue({
        id: 'contract-1',
        status: 'ACTIVE',
        activeRateCardId: 'rc-1',
      });

      const result = await service.activateRateCard(
        'contract-1',
        { rateCardId: 'rc-1' },
        'actor-1',
      );

      expect(result.status).toBe('ACTIVE');
      expect(prisma.rateCard.update).toHaveBeenCalledWith({
        where: { id: 'rc-1' },
        data: { status: 'ACTIVE' },
      });
      expect(auditService.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ action: 'CONTRACT_RATE_CARD_ACTIVATED' }),
      );
    });

    it('supersedes the previously active rate card when swapping to a new one', async () => {
      prisma.contract.findUnique.mockResolvedValue({
        ...contract,
        activeRateCardId: 'rc-old',
      });
      prisma.rateCard.findUnique.mockResolvedValue({
        id: 'rc-new',
        customerId: 'customer-1',
        status: 'DRAFT',
        components: [{ id: 'comp-1' }],
      });
      prisma.contract.update.mockResolvedValue({
        id: 'contract-1',
        status: 'ACTIVE',
        activeRateCardId: 'rc-new',
      });

      await service.activateRateCard(
        'contract-1',
        { rateCardId: 'rc-new' },
        'actor-1',
      );

      expect(prisma.rateCard.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rc-old' },
          data: expect.objectContaining({ status: 'SUPERSEDED' }),
        }),
      );
    });
  });
});
