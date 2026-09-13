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
import { BulkReassignRouteDto } from './dto/bulk-reassign-route.dto';
import { CreateFollowUpDto } from './dto/create-follow-up.dto';
import { FollowUpQueryDto } from './dto/follow-up-query.dto';
import { ReassignFollowUpDto } from './dto/reassign-follow-up.dto';
import { TransitionFollowUpDto } from './dto/transition-follow-up.dto';
import { FollowUpsService } from './follow-ups.service';

const CAN_MANAGE = [RoleName.SUPER_ADMIN, RoleName.ACCOUNTS_MANAGER];

@Controller('follow-ups')
export class FollowUpsController {
  constructor(private readonly followUpsService: FollowUpsService) {}

  // Any authenticated user — Collection Executives need this for their own queue.
  @Get('today')
  findTodaysFollowUps(@Query('assignedToId') assignedToId?: string) {
    return this.followUpsService.findTodaysFollowUps(assignedToId);
  }

  @Get('history')
  getHistory(
    @Query('customerId') customerId: string,
    @Query('invoiceId') invoiceId?: string,
  ) {
    return this.followUpsService.getHistory(customerId, invoiceId);
  }

  @Get()
  findAll(@Query() query: FollowUpQueryDto) {
    return this.followUpsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.followUpsService.findOneOrThrow(id);
  }

  @Post()
  create(
    @Body() dto: CreateFollowUpDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.followUpsService.create(dto, actor.id);
  }

  @Patch(':id/transition')
  transition(
    @Param('id') id: string,
    @Body() dto: TransitionFollowUpDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.followUpsService.transition(id, dto, actor.id);
  }

  @Patch(':id/reassign')
  @Roles(...CAN_MANAGE)
  reassign(
    @Param('id') id: string,
    @Body() dto: ReassignFollowUpDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.followUpsService.reassign(id, dto, actor.id);
  }

  @Post('bulk-reassign-route')
  @Roles(...CAN_MANAGE)
  bulkReassignByRoute(
    @Body() dto: BulkReassignRouteDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.followUpsService.bulkReassignByRoute(dto, actor.id);
  }

  @Post('run-overdue-check')
  @Roles(RoleName.SUPER_ADMIN)
  runOverdueCheck() {
    return this.followUpsService.runOverdueInvoiceCheck();
  }

  @Post('run-broken-promise-check')
  @Roles(RoleName.SUPER_ADMIN)
  runBrokenPromiseCheck() {
    return this.followUpsService.runBrokenPromiseCheck();
  }
}
