import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FollowUpsService } from './follow-ups.service';

@Injectable()
export class FollowUpsScheduler {
  private readonly logger = new Logger(FollowUpsScheduler.name);

  constructor(private readonly followUpsService: FollowUpsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleOverdueInvoiceCheck() {
    this.logger.log('Running scheduled overdue invoice check');
    await this.followUpsService.runOverdueInvoiceCheck();
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleBrokenPromiseCheck() {
    this.logger.log('Running scheduled broken promise check');
    await this.followUpsService.runBrokenPromiseCheck();
  }
}
