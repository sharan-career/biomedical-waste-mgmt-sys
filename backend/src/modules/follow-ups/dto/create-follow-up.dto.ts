import { FollowUpType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateFollowUpDto {
  @IsUUID()
  customerId: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsUUID()
  assignedToId: string;

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
