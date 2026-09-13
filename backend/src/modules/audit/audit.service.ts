import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type AuditableClient = PrismaService | Prisma.TransactionClient;

/**
 * Shared audit-log writer. Call `record(...)` with the SAME transaction client used
 * for the business-logic change (pass `tx` from a `prisma.$transaction` callback) so
 * an audit entry can never be lost to a crash between "entity updated" and
 * "audit logged" — see docs/API_ARCHITECTURE.md §4.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    client: AuditableClient,
    params: {
      userId: string | null;
      action: string;
      entityType: string;
      entityId: string;
      previousValue?: unknown;
      newValue?: unknown;
    },
  ): Promise<void> {
    await client.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        previousValue: params.previousValue as
          Prisma.InputJsonValue | undefined,
        newValue: params.newValue as Prisma.InputJsonValue | undefined,
      },
    });
  }

  findMany(params: { skip: number; take: number; entityType?: string }) {
    return this.prisma.auditLog.findMany({
      where: params.entityType ? { entityType: params.entityType } : undefined,
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
    });
  }

  count(params: { entityType?: string }) {
    return this.prisma.auditLog.count({
      where: params.entityType ? { entityType: params.entityType } : undefined,
    });
  }
}
