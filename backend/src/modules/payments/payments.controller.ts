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
import { ApplyCreditDto } from './dto/apply-credit.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import { PaymentsService } from './payments.service';

const CAN_MANAGE = [RoleName.SUPER_ADMIN, RoleName.ACCOUNTS_MANAGER];

@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('payments')
  @Roles(...CAN_MANAGE)
  record(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.paymentsService.record(dto, actor.id);
  }

  @Get('payments')
  findAll(@Query() query: PaymentQueryDto) {
    return this.paymentsService.findAll(query);
  }

  @Get('payments/aging')
  getAgingReport(@Query('customerId') customerId?: string) {
    return this.paymentsService.getAgingReport(customerId);
  }

  @Get('payments/:id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOneOrThrow(id);
  }

  @Patch('payments/:id/reverse')
  @Roles(...CAN_MANAGE)
  reverse(
    @Param('id') id: string,
    @Body() dto: ReversePaymentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.paymentsService.reverse(id, dto, actor.id);
  }

  @Get('customers/:id/credit-balance')
  getCreditBalance(@Param('id') id: string) {
    return this.paymentsService.getCreditBalance(id);
  }

  @Post('customers/:id/apply-credit')
  @Roles(...CAN_MANAGE)
  applyCredit(
    @Param('id') id: string,
    @Body() dto: ApplyCreditDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.paymentsService.applyCredit(id, dto, actor.id);
  }
}
