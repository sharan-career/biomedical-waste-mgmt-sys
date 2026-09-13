import { PaymentMode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class PaymentAllocationInputDto {
  @IsUUID()
  invoiceId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;
}

export class CreatePaymentDto {
  @IsUUID()
  customerId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(PaymentMode)
  paymentMode: PaymentMode;

  @IsDateString()
  paymentDate: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  bankDetails?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Optional — invoices to allocate this payment against. Any amount left over
  // (including the full amount, if omitted) becomes unallocated credit on the customer.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationInputDto)
  allocations?: PaymentAllocationInputDto[];
}
