import { IsString, MinLength } from 'class-validator';

export class CancelInvoiceDto {
  @IsString()
  @MinLength(2)
  reason: string;
}
