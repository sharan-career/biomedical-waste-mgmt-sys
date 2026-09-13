import { BillingFrequency } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateContractDto {
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(BillingFrequency)
  billingFrequency?: BillingFrequency;

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
