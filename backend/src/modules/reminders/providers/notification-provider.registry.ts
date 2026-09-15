import { Injectable } from '@nestjs/common';
import { ReminderChannel } from '@prisma/client';
import { LoggedNotificationProvider } from './logged-notification.provider';
import { NotificationProvider } from './notification-provider.interface';

@Injectable()
export class NotificationProviderRegistry {
  private readonly providers = new Map<ReminderChannel, NotificationProvider>([
    ['WHATSAPP', new LoggedNotificationProvider('WHATSAPP')],
    ['SMS', new LoggedNotificationProvider('SMS')],
    ['EMAIL', new LoggedNotificationProvider('EMAIL')],
  ]);

  get(channel: ReminderChannel): NotificationProvider {
    const provider = this.providers.get(channel);
    if (!provider) {
      throw new Error(
        `No NotificationProvider registered for channel ${channel}`,
      );
    }
    return provider;
  }
}
