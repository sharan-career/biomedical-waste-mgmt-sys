import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationProviderRegistry } from './providers/notification-provider.registry';
import { RemindersController } from './reminders.controller';
import { RemindersScheduler } from './reminders.scheduler';
import { RemindersService } from './reminders.service';

@Module({
  imports: [AuditModule],
  controllers: [RemindersController],
  providers: [
    RemindersService,
    RemindersScheduler,
    NotificationProviderRegistry,
  ],
  exports: [RemindersService],
})
export class RemindersModule {}
