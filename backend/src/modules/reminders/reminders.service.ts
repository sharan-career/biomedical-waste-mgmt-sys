import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, ReminderChannel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateReminderRuleDto } from './dto/create-reminder-rule.dto';
import { ReminderLogQueryDto } from './dto/reminder-log-query.dto';
import { UpdateReminderRuleDto } from './dto/update-reminder-rule.dto';
import { NotificationProviderRegistry } from './providers/notification-provider.registry';

const MAX_RETRIES = 2;

// Reminders pause while a follow-up on the invoice is in one of these states — never
// re-antagonize a customer already mid-dispute (see EDGE_CASES.md #6).
const PAUSE_REMINDER_FOLLOW_UP_STATUSES = ['DISPUTED', 'ESCALATED'];

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly providerRegistry: NotificationProviderRegistry,
  ) {}

  async createRule(dto: CreateReminderRuleDto, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const rule = await tx.reminderRule.create({
        data: { ...dto, createdBy: actorUserId, updatedBy: actorUserId },
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'REMINDER_RULE_CREATED',
        entityType: 'ReminderRule',
        entityId: rule.id,
        newValue: { name: rule.name, channel: rule.channel },
      });

      return rule;
    });
  }

  async updateRule(
    id: string,
    dto: UpdateReminderRuleDto,
    actorUserId: string,
  ) {
    const existing = await this.prisma.reminderRule.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Reminder rule not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.reminderRule.update({
        where: { id },
        data: { ...dto, updatedBy: actorUserId },
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'REMINDER_RULE_UPDATED',
        entityType: 'ReminderRule',
        entityId: id,
        previousValue: { active: existing.active },
        newValue: { active: updated.active },
      });

      return updated;
    });
  }

  findAllRules() {
    return this.prisma.reminderRule.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRuleOrThrow(id: string) {
    const rule = await this.prisma.reminderRule.findUnique({ where: { id } });
    if (!rule) {
      throw new NotFoundException('Reminder rule not found');
    }
    return rule;
  }

  async listLogs(query: ReminderLogQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.ReminderLogWhereInput = {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.invoiceId ? { invoiceId: query.invoiceId } : {}),
      ...(query.deliveryStatus ? { deliveryStatus: query.deliveryStatus } : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.reminderLog.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          rule: { select: { id: true, name: true } },
          customer: {
            select: { id: true, customerCode: true, organizationName: true },
          },
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      }),
      this.prisma.reminderLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: { total, page: query.page, limit: query.limit },
    };
  }

  /** The scheduled job body (also manually triggerable) — evaluates every active rule against
   * every unpaid invoice and sends (or retries) reminders as appropriate. */
  async evaluateAndSend(): Promise<{
    sent: number;
    failed: number;
    skippedDisputed: number;
  }> {
    const [rules, invoices] = await Promise.all([
      this.prisma.reminderRule.findMany({ where: { active: true } }),
      this.prisma.invoice.findMany({
        where: { status: { in: ['SENT', 'PARTIALLY_PAID'] } },
        include: {
          customer: { include: { contacts: true } },
          followUps: {
            where: { nextFollowUp: null },
            select: { status: true },
          },
        },
      }),
    ]);

    let sent = 0;
    let failed = 0;
    let skippedDisputed = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const invoice of invoices) {
      const activeFollowUpStatus = invoice.followUps[0]?.status;
      const isPaused =
        activeFollowUpStatus &&
        PAUSE_REMINDER_FOLLOW_UP_STATUSES.includes(activeFollowUpStatus);

      for (const rule of rules) {
        const triggerDate = this.computeTriggerDate(
          invoice.dueDate,
          rule.triggerType,
          rule.triggerOffsetDays,
        );
        if (today < triggerDate) continue; // not due yet

        if (isPaused) {
          skippedDisputed += 1;
          continue;
        }

        const existingLog = await this.prisma.reminderLog.findUnique({
          where: {
            ruleId_invoiceId: { ruleId: rule.id, invoiceId: invoice.id },
          },
        });
        // Already succeeded once — never re-fire the same rule for the same invoice.
        if (existingLog && existingLog.deliveryStatus !== 'FAILED') continue;
        // Failed and exhausted retries — leave it, surfaced via GET /reminders/logs?deliveryStatus=FAILED.
        if (existingLog && existingLog.retryCount >= MAX_RETRIES) continue;

        const to = this.resolveContact(invoice.customer.contacts, rule.channel);
        const message = this.buildMessage(rule.messageTemplate, {
          customerName: invoice.customer.organizationName,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.outstandingAmount.toString(),
          dueDate: invoice.dueDate.toDateString(),
        });

        const result = to
          ? await this.providerRegistry.get(rule.channel).send(to, message)
          : {
              success: false,
              error: `No ${rule.channel} contact on file for this customer`,
            };

        await this.upsertLog(
          rule.id,
          invoice.customerId,
          invoice.id,
          rule.channel,
          message,
          result,
          existingLog,
        );
        if (result.success) sent += 1;
        else failed += 1;
      }
    }

    this.logger.log(
      `Reminder run: sent ${sent}, failed ${failed}, skipped (disputed) ${skippedDisputed}`,
    );
    return { sent, failed, skippedDisputed };
  }

  private computeTriggerDate(
    dueDate: Date,
    triggerType: string,
    offsetDays: number,
  ): Date {
    const date = new Date(dueDate);
    date.setHours(0, 0, 0, 0);
    if (triggerType === 'DAYS_BEFORE_DUE')
      date.setDate(date.getDate() - offsetDays);
    else if (triggerType === 'DAYS_AFTER_DUE')
      date.setDate(date.getDate() + offsetDays);
    return date;
  }

  private resolveContact(
    contacts: {
      contactType: string;
      phone: string | null;
      email: string | null;
    }[],
    channel: ReminderChannel,
  ): string | null {
    const field = channel === 'EMAIL' ? 'email' : 'phone';
    const accountsContact = contacts.find(
      (c) => c.contactType === 'ACCOUNTS' && c[field],
    );
    if (accountsContact) return accountsContact[field] as string;
    const anyContact = contacts.find((c) => c[field]);
    return anyContact ? (anyContact[field] as string) : null;
  }

  /** `existingLog` is whatever the caller already looked up for this (ruleId, invoiceId) —
   * null means this is the first-ever attempt, otherwise it's a retry of a prior failure. */
  private async upsertLog(
    ruleId: string,
    customerId: string,
    invoiceId: string,
    channel: ReminderChannel,
    message: string,
    result: { success: boolean; error?: string },
    existingLog: { retryCount: number } | null,
  ) {
    await this.prisma.reminderLog.upsert({
      where: { ruleId_invoiceId: { ruleId, invoiceId } },
      create: {
        ruleId,
        customerId,
        invoiceId,
        channel,
        message,
        sentAt: result.success ? new Date() : null,
        deliveryStatus: result.success ? 'SENT' : 'FAILED',
        lastError: result.error,
        retryCount: 0,
      },
      update: {
        message,
        sentAt: result.success ? new Date() : null,
        deliveryStatus: result.success ? 'SENT' : 'FAILED',
        lastError: result.error ?? null,
        retryCount: existingLog ? existingLog.retryCount + 1 : 0,
      },
    });
  }

  private buildMessage(template: string, vars: Record<string, string>): string {
    return template.replace(
      /\{\{(\w+)\}\}/g,
      (_, key: string) => vars[key] ?? '',
    );
  }
}
