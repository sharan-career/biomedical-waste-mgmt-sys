import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RemindersService } from './reminders.service';

@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger(RemindersScheduler.name);

  constructor(private readonly remindersService: RemindersService) {}

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async handleReminderRun() {
    this.logger.log('Running scheduled reminder evaluation');
    await this.remindersService.evaluateAndSend();
  }
}
