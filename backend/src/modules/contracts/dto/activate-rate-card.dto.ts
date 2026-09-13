import { IsUUID } from 'class-validator';

export class ActivateRateCardDto {
  @IsUUID()
  rateCardId: string;
}
