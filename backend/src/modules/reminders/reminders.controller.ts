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
import { CreateReminderRuleDto } from './dto/create-reminder-rule.dto';
import { ReminderLogQueryDto } from './dto/reminder-log-query.dto';
import { UpdateReminderRuleDto } from './dto/update-reminder-rule.dto';
import { RemindersService } from './reminders.service';

const CAN_MANAGE = [RoleName.SUPER_ADMIN, RoleName.ACCOUNTS_MANAGER];

@Controller()
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get('reminder-rules')
  @Roles(...CAN_MANAGE)
  findAllRules() {
    return this.remindersService.findAllRules();
  }

  @Post('reminder-rules')
  @Roles(...CAN_MANAGE)
  createRule(
    @Body() dto: CreateReminderRuleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.remindersService.createRule(dto, actor.id);
  }

  @Patch('reminder-rules/:id')
  @Roles(...CAN_MANAGE)
  updateRule(
    @Param('id') id: string,
    @Body() dto: UpdateReminderRuleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.remindersService.updateRule(id, dto, actor.id);
  }

  @Get('reminder-logs')
  listLogs(@Query() query: ReminderLogQueryDto) {
    return this.remindersService.listLogs(query);
  }

  @Post('reminders/run-check')
  @Roles(RoleName.SUPER_ADMIN)
  runCheck() {
    return this.remindersService.evaluateAndSend();
  }
}
