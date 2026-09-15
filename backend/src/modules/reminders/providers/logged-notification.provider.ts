import { Injectable, Logger } from '@nestjs/common';
import { ReminderChannel } from '@prisma/client';
import {
  NotificationProvider,
  SendResult,
} from './notification-provider.interface';

/**
 * Stub used for every channel until the business confirms which real provider (WhatsApp
 * Business API / SMS gateway / SMTP) to pay for and integrate — logs instead of sending,
 * always "succeeds" so the rule-engine/scheduling/duplicate-suppression logic can be built
 * and tested now without blocking on that decision.
 */
@Injectable()
export class LoggedNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger(LoggedNotificationProvider.name);

  constructor(public readonly channel: ReminderChannel) {}

  async send(to: string, message: string): Promise<SendResult> {
    this.logger.log(`[STUB ${this.channel}] would send to ${to}: ${message}`);
    return { success: true };
  }
}
