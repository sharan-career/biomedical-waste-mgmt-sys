import { BillingFrequency } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateContractDto {
  @IsString()
  @MinLength(2)
  contractNumber: string;

  @IsUUID()
  customerId: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsEnum(BillingFrequency)
  billingFrequency: BillingFrequency;

  @IsOptional()
  @IsInt()
  @Min(1)
  billingDayOfPeriod?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  paymentTermsDays?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
