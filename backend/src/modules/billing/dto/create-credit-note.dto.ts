import { IsNumber, IsString, Min, MinLength } from 'class-validator';

export class CreateCreditNoteDto {
  @IsString()
  @MinLength(2)
  reason: string;

  @IsNumber()
  @Min(0.01)
  amount: number;
}
