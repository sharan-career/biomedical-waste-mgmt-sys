import { IsNumber, IsUUID, Min } from 'class-validator';

export class ApplyCreditDto {
  @IsUUID()
  invoiceId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;
}
