import { ReminderChannel, ReminderTriggerType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateReminderRuleDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEnum(ReminderTriggerType)
  triggerType: ReminderTriggerType;

  @IsInt()
  @Min(0)
  triggerOffsetDays: number;

  @IsEnum(ReminderChannel)
  channel: ReminderChannel;

  @IsString()
  @MinLength(2)
  messageTemplate: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
