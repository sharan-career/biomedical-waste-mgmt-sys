import { CustomerType, FacilityType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  customerCode: string;

  @IsString()
  @MinLength(2)
  organizationName: string;

  @IsEnum(CustomerType)
  customerType: CustomerType;

  @IsEnum(FacilityType)
  facilityType: FacilityType;

  @IsOptional()
  @IsInt()
  @Min(0)
  bedCount?: number;

  @IsUUID()
  talukaId: string;

  @IsOptional()
  @IsUUID()
  routeId?: string;

  @IsString()
  @MinLength(2)
  address: string;

  @IsString()
  @MinLength(2)
  city: string;

  @IsString()
  @MinLength(2)
  state: string;

  @IsString()
  @MinLength(4)
  pincode: string;

  @IsOptional()
  @IsString()
  gstNumber?: string;

  @IsOptional()
  @IsString()
  panNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  paymentTermsDays?: number;
}
