import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  let service: CustomersService;
  let prisma: {
    customer: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    customerContact: {
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findFirst: jest.Mock;
    };
    taluka: { findUnique: jest.Mock };
    route: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditService: { record: jest.Mock };

  const baseDto = {
    customerCode: 'KLB-0001',
    organizationName: 'City Hospital',
    customerType: 'PRIVATE' as const,
    facilityType: 'BEDDED_HOSPITAL' as const,
    talukaId: 'taluka-1',
    address: '123 Main St',
    city: 'Kalaburagi',
    state: 'Karnataka',
    pincode: '585101',
  };

  beforeEach(() => {
    prisma = {
      customer: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      customerContact: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
      },
      taluka: { findUnique: jest.fn() },
      route: { findUnique: jest.fn() },
      $transaction: jest.fn((callback) => callback(prisma)),
    };
    auditService = { record: jest.fn() };

    service = new CustomersService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );
  });

  describe('create', () => {
    it('rejects a duplicate customer code', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create(baseDto, 'actor-1')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.taluka.findUnique).not.toHaveBeenCalled();
    });

    it('rejects an unknown taluka', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      prisma.taluka.findUnique.mockResolvedValue(null);

      await expect(service.create(baseDto, 'actor-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a route that belongs to a different taluka', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      prisma.taluka.findUnique.mockResolvedValue({ id: 'taluka-1' });
      prisma.route.findUnique.mockResolvedValue({
        id: 'route-1',
        talukaId: 'taluka-2',
      });

      await expect(
        service.create({ ...baseDto, routeId: 'route-1' }, 'actor-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates the customer and records an audit entry', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      prisma.taluka.findUnique.mockResolvedValue({ id: 'taluka-1' });
      prisma.customer.create.mockResolvedValue({
        id: 'customer-1',
        customerCode: baseDto.customerCode,
        organizationName: baseDto.organizationName,
      });

      const result = await service.create(baseDto, 'actor-1');

      expect(result.id).toBe('customer-1');
      expect(auditService.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          action: 'CUSTOMER_CREATED',
          entityId: 'customer-1',
        }),
      );
    });
  });

  describe('findOneOrThrow', () => {
    it('throws NotFoundException when the customer does not exist', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      await expect(service.findOneOrThrow('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('records a CUSTOMER_STATUS_CHANGED audit entry', async () => {
      prisma.customer.findFirst.mockResolvedValue({
        id: 'customer-1',
        status: 'ACTIVE',
      });
      prisma.customer.update.mockResolvedValue({
        id: 'customer-1',
        status: 'INACTIVE',
      });

      await service.updateStatus('customer-1', 'INACTIVE', 'actor-1');

      expect(auditService.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          action: 'CUSTOMER_STATUS_CHANGED',
          previousValue: { status: 'ACTIVE' },
          newValue: { status: 'INACTIVE' },
        }),
      );
    });
  });

  describe('removeContact', () => {
    it('throws NotFoundException when the contact does not belong to the customer', async () => {
      prisma.customerContact.findFirst.mockResolvedValue(null);
      await expect(
        service.removeContact('customer-1', 'contact-1', 'actor-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
