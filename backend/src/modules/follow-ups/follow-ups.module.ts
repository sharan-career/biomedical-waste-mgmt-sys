import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { FollowUpsController } from './follow-ups.controller';
import { FollowUpsScheduler } from './follow-ups.scheduler';
import { FollowUpsService } from './follow-ups.service';

@Module({
  imports: [AuditModule],
  controllers: [FollowUpsController],
  providers: [FollowUpsService, FollowUpsScheduler],
  exports: [FollowUpsService],
})
export class FollowUpsModule {}
