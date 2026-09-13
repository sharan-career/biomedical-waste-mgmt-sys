import { IsString, MinLength } from 'class-validator';

export class ReversePaymentDto {
  @IsString()
  @MinLength(2)
  reason: string;
}
