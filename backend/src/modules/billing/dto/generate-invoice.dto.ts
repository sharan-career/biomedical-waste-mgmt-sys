import { IsDateString, IsOptional, IsUUID, IsString } from 'class-validator';

export class GenerateInvoiceDto {
  @IsUUID()
  contractId: string;

  @IsDateString()
  billingPeriodStart: string;

  @IsDateString()
  billingPeriodEnd: string;

  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
