import { FollowUpType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

// OPEN is only reachable at creation, never a transition target.
export type FollowUpTransitionStatus =
  'FOLLOW_UP_REQUIRED' | 'PROMISE_TO_PAY' | 'DISPUTED' | 'ESCALATED' | 'CLOSED';

export class TransitionFollowUpDto {
  @IsIn([
    'FOLLOW_UP_REQUIRED',
    'PROMISE_TO_PAY',
    'DISPUTED',
    'ESCALATED',
    'CLOSED',
  ])
  status: FollowUpTransitionStatus;

  @IsDateString()
  followUpDate: string;

  @IsEnum(FollowUpType)
  followUpType: FollowUpType;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  discussionNotes?: string;

  @IsOptional()
  @IsString()
  customerResponse?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  promiseAmount?: number;

  @IsOptional()
  @IsDateString()
  promisePaymentDate?: string;

  @IsOptional()
  @IsDateString()
  nextFollowUpDate?: string;
}
