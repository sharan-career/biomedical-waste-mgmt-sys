import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [PaymentsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
