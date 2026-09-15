import { ReminderChannel } from '@prisma/client';

export interface SendResult {
  success: boolean;
  error?: string;
}

/**
 * Every channel (WhatsApp/SMS/Email) implements this. Swapping in a real provider later
 * (Gupshup, MSG91, SES, ...) means writing one class and registering it below — nothing
 * in RemindersService changes (see BUSINESS_REQUIREMENTS.md "Extensibility").
 */
export interface NotificationProvider {
  readonly channel: ReminderChannel;
  send(to: string, message: string): Promise<SendResult>;
}
