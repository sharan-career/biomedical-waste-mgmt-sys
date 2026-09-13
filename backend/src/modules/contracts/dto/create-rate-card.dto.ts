import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { RateCardComponentType } from '@prisma/client';

export class RateCardComponentDto {
  @IsEnum(RateCardComponentType)
  componentType: RateCardComponentType;

  @IsNumber()
  @Min(0)
  unitAmount: number;

  @IsOptional()
  @IsBoolean()
  taxable?: boolean;
}

export class CreateRateCardDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsDateString()
  effectiveFrom: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RateCardComponentDto)
  components: RateCardComponentDto[];
}
