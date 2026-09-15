import { PartialType } from '@nestjs/mapped-types';
import { CreateReminderRuleDto } from './create-reminder-rule.dto';

export class UpdateReminderRuleDto extends PartialType(CreateReminderRuleDto) {}
