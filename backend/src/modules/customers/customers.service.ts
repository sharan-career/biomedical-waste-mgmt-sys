import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCustomerContactDto } from './dto/create-customer-contact.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { UpdateCustomerContactDto } from './dto/update-customer-contact.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const CUSTOMER_INCLUDE = { taluka: true, route: true, contacts: true } as const;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateCustomerDto, actorUserId: string) {
    const existing = await this.prisma.customer.findUnique({
      where: { customerCode: dto.customerCode },
    });
    if (existing) {
      throw new ConflictException(
        'A customer with this customer code already exists',
      );
    }

    await this.assertTalukaAndRouteExist(dto.talukaId, dto.routeId);

    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: { ...dto, createdBy: actorUserId, updatedBy: actorUserId },
        include: CUSTOMER_INCLUDE,
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'CUSTOMER_CREATED',
        entityType: 'Customer',
        entityId: customer.id,
        newValue: {
          customerCode: customer.customerCode,
          organizationName: customer.organizationName,
        },
      });

      return customer;
    });
  }

  async findAll(query: CustomerQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(query.talukaId ? { talukaId: query.talukaId } : {}),
      ...(query.routeId ? { routeId: query.routeId } : {}),
      ...(query.facilityType ? { facilityType: query.facilityType } : {}),
      ...(query.customerType ? { customerType: query.customerType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              {
                organizationName: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              { customerCode: { contains: query.search, mode: 'insensitive' } },
              { city: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: CUSTOMER_INCLUDE,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: customers,
      meta: { total, page: query.page, limit: query.limit },
    };
  }

  async findOneOrThrow(id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: CUSTOMER_INCLUDE,
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto, actorUserId: string) {
    const before = await this.findOneOrThrow(id);

    if (dto.customerCode && dto.customerCode !== before.customerCode) {
      const existing = await this.prisma.customer.findUnique({
        where: { customerCode: dto.customerCode },
      });
      if (existing) {
        throw new ConflictException(
          'A customer with this customer code already exists',
        );
      }
    }
    await this.assertTalukaAndRouteExist(
      dto.talukaId ?? before.talukaId,
      dto.routeId !== undefined ? dto.routeId : (before.routeId ?? undefined),
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: { ...dto, updatedBy: actorUserId },
        include: CUSTOMER_INCLUDE,
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'CUSTOMER_UPDATED',
        entityType: 'Customer',
        entityId: id,
        previousValue: {
          organizationName: before.organizationName,
          status: before.status,
        },
        newValue: {
          organizationName: updated.organizationName,
          status: updated.status,
        },
      });

      return updated;
    });
  }

  async updateStatus(id: string, status: CustomerStatus, actorUserId: string) {
    const before = await this.findOneOrThrow(id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: { status, updatedBy: actorUserId },
        include: CUSTOMER_INCLUDE,
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'CUSTOMER_STATUS_CHANGED',
        entityType: 'Customer',
        entityId: id,
        previousValue: { status: before.status },
        newValue: { status: updated.status },
      });

      return updated;
    });
  }

  async addContact(
    customerId: string,
    dto: CreateCustomerContactDto,
    actorUserId: string,
  ) {
    await this.findOneOrThrow(customerId);

    return this.prisma.$transaction(async (tx) => {
      const contact = await tx.customerContact.create({
        data: { ...dto, customerId },
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'CUSTOMER_CONTACT_ADDED',
        entityType: 'Customer',
        entityId: customerId,
        newValue: { contactType: contact.contactType, name: contact.name },
      });

      return contact;
    });
  }

  async updateContact(
    customerId: string,
    contactId: string,
    dto: UpdateCustomerContactDto,
    actorUserId: string,
  ) {
    const contact = await this.findContactOrThrow(customerId, contactId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customerContact.update({
        where: { id: contactId },
        data: dto,
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'CUSTOMER_CONTACT_UPDATED',
        entityType: 'Customer',
        entityId: customerId,
        previousValue: {
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
        },
        newValue: {
          name: updated.name,
          phone: updated.phone,
          email: updated.email,
        },
      });

      return updated;
    });
  }

  async removeContact(
    customerId: string,
    contactId: string,
    actorUserId: string,
  ) {
    const contact = await this.findContactOrThrow(customerId, contactId);

    await this.prisma.$transaction(async (tx) => {
      await tx.customerContact.delete({ where: { id: contactId } });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'CUSTOMER_CONTACT_REMOVED',
        entityType: 'Customer',
        entityId: customerId,
        previousValue: { name: contact.name, contactType: contact.contactType },
      });
    });
  }

  private async findContactOrThrow(customerId: string, contactId: string) {
    const contact = await this.prisma.customerContact.findFirst({
      where: { id: contactId, customerId },
    });
    if (!contact) {
      throw new NotFoundException('Customer contact not found');
    }
    return contact;
  }

  private async assertTalukaAndRouteExist(
    talukaId: string,
    routeId?: string,
  ): Promise<void> {
    const taluka = await this.prisma.taluka.findUnique({
      where: { id: talukaId },
    });
    if (!taluka) {
      throw new NotFoundException('Taluka not found');
    }
    if (routeId) {
      const route = await this.prisma.route.findUnique({
        where: { id: routeId },
      });
      if (!route || route.talukaId !== talukaId) {
        throw new NotFoundException('Route not found for the given taluka');
      }
    }
  }
}
