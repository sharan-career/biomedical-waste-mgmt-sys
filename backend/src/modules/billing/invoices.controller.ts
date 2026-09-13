import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { CreditNotesService } from './credit-notes.service';
import { CancelInvoiceDto } from './dto/cancel-invoice.dto';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { InvoicesService } from './invoices.service';

const CAN_MANAGE = [RoleName.SUPER_ADMIN, RoleName.ACCOUNTS_MANAGER];

@Controller()
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly creditNotesService: CreditNotesService,
  ) {}

  @Post('billing/generate')
  @Roles(...CAN_MANAGE)
  generate(
    @Body() dto: GenerateInvoiceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.invoicesService.generate(dto, actor.id);
  }

  @Get('invoices')
  findAll(@Query() query: InvoiceQueryDto) {
    return this.invoicesService.findAll(query);
  }

  @Get('invoices/org-profile')
  getOrgProfile() {
    return this.invoicesService.getOrgProfile();
  }

  @Get('invoices/:id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOneOrThrow(id);
  }

  @Patch('invoices/:id/approve')
  @Roles(...CAN_MANAGE)
  approve(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.invoicesService.approve(id, actor.id);
  }

  @Patch('invoices/:id/send')
  @Roles(...CAN_MANAGE)
  markSent(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.invoicesService.markSent(id, actor.id);
  }

  @Patch('invoices/:id/cancel')
  @Roles(...CAN_MANAGE)
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelInvoiceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.invoicesService.cancel(id, dto, actor.id);
  }

  @Get('invoices/:id/credit-notes')
  listCreditNotes(@Param('id') id: string) {
    return this.creditNotesService.findAllForInvoice(id);
  }

  @Post('invoices/:id/credit-notes')
  @Roles(...CAN_MANAGE)
  createCreditNote(
    @Param('id') id: string,
    @Body() dto: CreateCreditNoteDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.creditNotesService.create(id, dto, actor.id);
  }
}
