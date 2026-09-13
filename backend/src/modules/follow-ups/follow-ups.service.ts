import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FollowUpStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BulkReassignRouteDto } from './dto/bulk-reassign-route.dto';
import { CreateFollowUpDto } from './dto/create-follow-up.dto';
import { FollowUpQueryDto } from './dto/follow-up-query.dto';
import { ReassignFollowUpDto } from './dto/reassign-follow-up.dto';
import { TransitionFollowUpDto } from './dto/transition-follow-up.dto';

const FOLLOW_UP_INCLUDE = {
  customer: {
    select: {
      id: true,
      customerCode: true,
      organizationName: true,
      routeId: true,
    },
  },
  invoice: {
    select: { id: true, invoiceNumber: true, outstandingAmount: true },
  },
  assignedTo: { select: { id: true, fullName: true } },
} as const;

@Injectable()
export class FollowUpsService {
  private readonly logger = new Logger(FollowUpsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateFollowUpDto, actorUserId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    if (dto.invoiceId) {
      const invoice = await this.prisma.invoice.findFirst({
        where: { id: dto.invoiceId, customerId: dto.customerId },
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found for this customer');
      }
    }
    const assignee = await this.prisma.user.findFirst({
      where: { id: dto.assignedToId, status: 'ACTIVE' },
    });
    if (!assignee) {
      throw new NotFoundException('Assigned user not found or inactive');
    }

    return this.prisma.$transaction(async (tx) => {
      const followUp = await tx.followUp.create({
        data: {
          customerId: dto.customerId,
          invoiceId: dto.invoiceId,
          assignedToId: dto.assignedToId,
          followUpDate: new Date(dto.followUpDate),
          followUpType: dto.followUpType,
          contactPerson: dto.contactPerson,
          discussionNotes: dto.discussionNotes,
          customerResponse: dto.customerResponse,
          promiseAmount: dto.promiseAmount,
          promisePaymentDate: dto.promisePaymentDate
            ? new Date(dto.promisePaymentDate)
            : undefined,
          nextFollowUpDate: dto.nextFollowUpDate
            ? new Date(dto.nextFollowUpDate)
            : undefined,
          createdBy: actorUserId,
          updatedBy: actorUserId,
        },
        include: FOLLOW_UP_INCLUDE,
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'FOLLOW_UP_CREATED',
        entityType: 'FollowUp',
        entityId: followUp.id,
        newValue: {
          customerId: dto.customerId,
          assignedToId: dto.assignedToId,
        },
      });

      return followUp;
    });
  }

  async findAll(query: FollowUpQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.FollowUpWhereInput = {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.invoiceId ? { invoiceId: query.invoiceId } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [followUps, total] = await Promise.all([
      this.prisma.followUp.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: FOLLOW_UP_INCLUDE,
      }),
      this.prisma.followUp.count({ where }),
    ]);

    return {
      data: followUps,
      meta: { total, page: query.page, limit: query.limit },
    };
  }

  /** The Collection Executive's primary screen — only the "current" row per chain, not history. */
  async findTodaysFollowUps(assignedToId?: string) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    return this.prisma.followUp.findMany({
      where: {
        nextFollowUp: null,
        status: { not: 'CLOSED' },
        ...(assignedToId ? { assignedToId } : {}),
        OR: [
          { nextFollowUpDate: { lte: today } },
          { status: 'PROMISE_TO_PAY', promisePaymentDate: { lte: today } },
        ],
      },
      orderBy: { followUpDate: 'asc' },
      include: FOLLOW_UP_INCLUDE,
    });
  }

  async findOneOrThrow(id: string) {
    const followUp = await this.prisma.followUp.findUnique({
      where: { id },
      include: FOLLOW_UP_INCLUDE,
    });
    if (!followUp) {
      throw new NotFoundException('Follow-up not found');
    }
    return followUp;
  }

  /** Full history for a case, oldest first, by following the previousFollowUpId chain's owner (customer+invoice). */
  async getHistory(customerId: string, invoiceId?: string) {
    return this.prisma.followUp.findMany({
      where: { customerId, invoiceId: invoiceId ?? null },
      orderBy: { createdAt: 'asc' },
      include: FOLLOW_UP_INCLUDE,
    });
  }

  async transition(
    id: string,
    dto: TransitionFollowUpDto,
    actorUserId: string,
  ) {
    const current = await this.findOneOrThrow(id);
    if (current.status === 'CLOSED') {
      throw new BadRequestException('This follow-up is already closed');
    }

    return this.prisma.$transaction(async (tx) => {
      const next = await tx.followUp.create({
        data: {
          customerId: current.customerId,
          invoiceId: current.invoiceId,
          assignedToId: current.assignedToId,
          followUpDate: new Date(dto.followUpDate),
          followUpType: dto.followUpType,
          contactPerson: dto.contactPerson,
          discussionNotes: dto.discussionNotes,
          customerResponse: dto.customerResponse,
          promiseAmount: dto.promiseAmount,
          promisePaymentDate: dto.promisePaymentDate
            ? new Date(dto.promisePaymentDate)
            : undefined,
          nextFollowUpDate: dto.nextFollowUpDate
            ? new Date(dto.nextFollowUpDate)
            : undefined,
          status: dto.status as FollowUpStatus,
          previousFollowUpId: current.id,
          createdBy: actorUserId,
          updatedBy: actorUserId,
        },
        include: FOLLOW_UP_INCLUDE,
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'FOLLOW_UP_STATUS_CHANGED',
        entityType: 'FollowUp',
        entityId: next.id,
        previousValue: { status: current.status, followUpId: current.id },
        newValue: { status: next.status },
      });

      return next;
    });
  }

  async reassign(id: string, dto: ReassignFollowUpDto, actorUserId: string) {
    const current = await this.findOneOrThrow(id);
    if (current.status === 'CLOSED') {
      throw new BadRequestException('Cannot reassign a closed follow-up');
    }
    const assignee = await this.prisma.user.findFirst({
      where: { id: dto.assignedToId, status: 'ACTIVE' },
    });
    if (!assignee) {
      throw new NotFoundException('Assigned user not found or inactive');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.followUp.update({
        where: { id },
        data: {
          previousAssignedToId: current.assignedToId,
          assignedToId: dto.assignedToId,
          updatedBy: actorUserId,
        },
        include: FOLLOW_UP_INCLUDE,
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'FOLLOW_UP_REASSIGNED',
        entityType: 'FollowUp',
        entityId: id,
        previousValue: { assignedToId: current.assignedToId },
        newValue: { assignedToId: dto.assignedToId },
      });

      return updated;
    });
  }

  async bulkReassignByRoute(dto: BulkReassignRouteDto, actorUserId: string) {
    const assignee = await this.prisma.user.findFirst({
      where: { id: dto.assignedToId, status: 'ACTIVE' },
    });
    if (!assignee) {
      throw new NotFoundException('Assigned user not found or inactive');
    }

    const openFollowUps = await this.prisma.followUp.findMany({
      where: {
        status: { not: 'CLOSED' },
        nextFollowUp: null,
        customer: { routeId: dto.routeId },
      },
    });

    return this.prisma.$transaction(async (tx) => {
      for (const followUp of openFollowUps) {
        await tx.followUp.update({
          where: { id: followUp.id },
          data: {
            previousAssignedToId: followUp.assignedToId,
            assignedToId: dto.assignedToId,
            updatedBy: actorUserId,
          },
        });
      }

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'FOLLOW_UP_BULK_REASSIGNED',
        entityType: 'Route',
        entityId: dto.routeId,
        newValue: {
          assignedToId: dto.assignedToId,
          count: openFollowUps.length,
        },
      });

      return { reassignedCount: openFollowUps.length };
    });
  }

  /** Scheduled job (also manually triggerable) — auto-opens a follow-up for each newly-overdue
   * invoice that doesn't already have an active one. Skips customers with no route executive
   * assigned yet, since assignedToId is required — those need manual assignment. */
  async runOverdueInvoiceCheck(): Promise<{
    created: number;
    skipped: number;
  }> {
    const today = new Date();
    const overdueInvoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['SENT', 'PARTIALLY_PAID'] },
        dueDate: { lt: today },
        followUps: { none: { nextFollowUp: null, status: { not: 'CLOSED' } } },
      },
      include: { customer: { include: { route: true } } },
    });

    let created = 0;
    let skipped = 0;
    for (const invoice of overdueInvoices) {
      const assignedToId = invoice.customer.route?.assignedExecutiveId;
      if (!assignedToId) {
        skipped += 1;
        continue;
      }
      await this.prisma.followUp.create({
        data: {
          customerId: invoice.customerId,
          invoiceId: invoice.id,
          assignedToId,
          followUpDate: today,
          // Set so it immediately surfaces on the executive's "Follow-ups Today" screen —
          // that's the entire point of auto-creating it.
          nextFollowUpDate: today,
          followUpType: 'OTHER',
          discussionNotes: `Auto-created: invoice ${invoice.invoiceNumber} is overdue.`,
          isSystemGenerated: true,
        },
      });
      created += 1;
    }
    this.logger.log(
      `Overdue invoice check: created ${created}, skipped ${skipped} (no route executive)`,
    );
    return { created, skipped };
  }

  /** Scheduled job — flags PROMISE_TO_PAY follow-ups whose promised date has passed with the
   * invoice still not fully paid, transitioning them to FOLLOW_UP_REQUIRED as a distinctly
   * flagged "broken promise" (see EDGE_CASES.md #10). */
  async runBrokenPromiseCheck(): Promise<{ flagged: number }> {
    const today = new Date();
    const brokenPromises = await this.prisma.followUp.findMany({
      where: {
        status: 'PROMISE_TO_PAY',
        nextFollowUp: null,
        promisePaymentDate: { lt: today },
      },
      include: { invoice: true },
    });

    let flagged = 0;
    for (const followUp of brokenPromises) {
      if (followUp.invoice && followUp.invoice.status === 'PAID') continue;

      await this.prisma.followUp.create({
        data: {
          customerId: followUp.customerId,
          invoiceId: followUp.invoiceId,
          assignedToId: followUp.assignedToId,
          followUpDate: today,
          // Set so it immediately surfaces on the executive's "Follow-ups Today" screen,
          // distinctly flagged via isSystemGenerated (see EDGE_CASES.md #10).
          nextFollowUpDate: today,
          followUpType: followUp.followUpType,
          discussionNotes: `Broken promise: promised ₹${followUp.promiseAmount ?? '—'} by ${
            followUp.promisePaymentDate?.toDateString() ?? '—'
          }, not received.`,
          status: 'FOLLOW_UP_REQUIRED',
          previousFollowUpId: followUp.id,
          isSystemGenerated: true,
        },
      });
      flagged += 1;
    }
    this.logger.log(`Broken promise check: flagged ${flagged}`);
    return { flagged };
  }
}
