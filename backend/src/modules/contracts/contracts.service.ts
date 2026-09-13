import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContractStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ActivateRateCardDto } from './dto/activate-rate-card.dto';
import { ContractQueryDto } from './dto/contract-query.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreateRateCardDto } from './dto/create-rate-card.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

const CONTRACT_INCLUDE = {
  customer: {
    select: { id: true, customerCode: true, organizationName: true },
  },
  activeRateCard: { include: { components: true } },
} as const;

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateContractDto, actorUserId: string) {
    const existing = await this.prisma.contract.findUnique({
      where: { contractNumber: dto.contractNumber },
    });
    if (existing) {
      throw new ConflictException(
        'A contract with this contract number already exists',
      );
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const contract = await tx.contract.create({
        data: {
          contractNumber: dto.contractNumber,
          customerId: dto.customerId,
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          billingFrequency: dto.billingFrequency,
          billingDayOfPeriod: dto.billingDayOfPeriod,
          paymentTermsDays: dto.paymentTermsDays,
          notes: dto.notes,
          createdBy: actorUserId,
          updatedBy: actorUserId,
        },
        include: CONTRACT_INCLUDE,
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'CONTRACT_CREATED',
        entityType: 'Contract',
        entityId: contract.id,
        newValue: {
          contractNumber: contract.contractNumber,
          customerId: contract.customerId,
        },
      });

      return contract;
    });
  }

  async findAll(query: ContractQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.ContractWhereInput = {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { contractNumber: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [contracts, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: CONTRACT_INCLUDE,
      }),
      this.prisma.contract.count({ where }),
    ]);

    return {
      data: contracts,
      meta: { total, page: query.page, limit: query.limit },
    };
  }

  async findOneOrThrow(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: CONTRACT_INCLUDE,
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }
    return contract;
  }

  async update(id: string, dto: UpdateContractDto, actorUserId: string) {
    const before = await this.findOneOrThrow(id);
    if (before.status === 'TERMINATED') {
      throw new BadRequestException('Cannot edit a terminated contract');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.contract.update({
        where: { id },
        data: {
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          billingFrequency: dto.billingFrequency,
          billingDayOfPeriod: dto.billingDayOfPeriod,
          paymentTermsDays: dto.paymentTermsDays,
          notes: dto.notes,
          updatedBy: actorUserId,
        },
        include: CONTRACT_INCLUDE,
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'CONTRACT_UPDATED',
        entityType: 'Contract',
        entityId: id,
        previousValue: { notes: before.notes, endDate: before.endDate },
        newValue: { notes: updated.notes, endDate: updated.endDate },
      });

      return updated;
    });
  }

  async updateStatus(
    id: string,
    status: 'EXPIRED' | 'TERMINATED',
    actorUserId: string,
  ) {
    const before = await this.findOneOrThrow(id);
    if (before.status === 'TERMINATED' || before.status === 'EXPIRED') {
      throw new BadRequestException(
        `Contract is already ${before.status.toLowerCase()}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.contract.update({
        where: { id },
        data: { status: status as ContractStatus, updatedBy: actorUserId },
        include: CONTRACT_INCLUDE,
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'CONTRACT_STATUS_CHANGED',
        entityType: 'Contract',
        entityId: id,
        previousValue: { status: before.status },
        newValue: { status: updated.status },
      });

      return updated;
    });
  }

  /**
   * Rate cards are customer-scoped (per docs/DATABASE_DESIGN.md), not contract-scoped —
   * this creates one for the contract's customer. Listing "rate cards for a contract"
   * below returns every version for that customer, which is correct as long as a
   * customer has at most one contract at a time (documented open question; revisit if
   * multi-contract-per-customer is confirmed needed).
   */
  async createRateCard(
    contractId: string,
    dto: CreateRateCardDto,
    actorUserId: string,
  ) {
    const contract = await this.findOneOrThrow(contractId);

    return this.prisma.$transaction(async (tx) => {
      const rateCard = await tx.rateCard.create({
        data: {
          name: dto.name,
          customerId: contract.customerId,
          effectiveFrom: new Date(dto.effectiveFrom),
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
          createdBy: actorUserId,
          updatedBy: actorUserId,
          components: {
            create: dto.components.map((component) => ({
              componentType: component.componentType,
              unitAmount: component.unitAmount,
              taxable: component.taxable ?? false,
            })),
          },
        },
        include: { components: true },
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'RATE_CARD_CREATED',
        entityType: 'Contract',
        entityId: contractId,
        newValue: { rateCardId: rateCard.id, name: rateCard.name },
      });

      return rateCard;
    });
  }

  async listRateCards(contractId: string) {
    const contract = await this.findOneOrThrow(contractId);
    return this.prisma.rateCard.findMany({
      where: { customerId: contract.customerId },
      include: { components: true },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async activateRateCard(
    contractId: string,
    dto: ActivateRateCardDto,
    actorUserId: string,
  ) {
    const contract = await this.findOneOrThrow(contractId);
    if (contract.status === 'TERMINATED' || contract.status === 'EXPIRED') {
      throw new BadRequestException(
        `Cannot activate a rate card on a ${contract.status.toLowerCase()} contract`,
      );
    }

    const rateCard = await this.prisma.rateCard.findUnique({
      where: { id: dto.rateCardId },
      include: { components: true },
    });
    if (!rateCard || rateCard.customerId !== contract.customerId) {
      throw new NotFoundException('Rate card not found for this contract');
    }
    if (rateCard.status !== 'DRAFT') {
      throw new BadRequestException('Only a DRAFT rate card can be activated');
    }
    if (rateCard.components.length === 0) {
      throw new BadRequestException('Rate card has no pricing components');
    }

    return this.prisma.$transaction(async (tx) => {
      if (contract.activeRateCardId) {
        await tx.contract.update({
          where: { id: contractId },
          data: { activeRateCardId: null },
        });
        await tx.rateCard.update({
          where: { id: contract.activeRateCardId },
          data: { status: 'SUPERSEDED', effectiveTo: new Date() },
        });
      }

      await tx.rateCard.update({
        where: { id: rateCard.id },
        data: { status: 'ACTIVE' },
      });

      const updatedContract = await tx.contract.update({
        where: { id: contractId },
        data: {
          activeRateCardId: rateCard.id,
          status: 'ACTIVE',
          updatedBy: actorUserId,
        },
        include: CONTRACT_INCLUDE,
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'CONTRACT_RATE_CARD_ACTIVATED',
        entityType: 'Contract',
        entityId: contractId,
        newValue: { rateCardId: rateCard.id },
      });

      return updatedContract;
    });
  }
}
