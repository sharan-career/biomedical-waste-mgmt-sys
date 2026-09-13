import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CreditNotesController } from './credit-notes.controller';
import { CreditNotesService } from './credit-notes.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [AuditModule],
  controllers: [InvoicesController, CreditNotesController],
  providers: [InvoicesService, CreditNotesService],
  exports: [InvoicesService, CreditNotesService],
})
export class BillingModule {}
