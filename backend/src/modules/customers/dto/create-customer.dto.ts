import { CustomerType, FacilityType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

// An HTML <select> with no option chosen submits "" — treat that the same as omitted,
// rather than 400ing on an optional field just because the client sent an empty string.
const emptyStringToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

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
  @Transform(emptyStringToUndefined)
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
  @Transform(emptyStringToUndefined)
  @IsString()
  gstNumber?: string;

  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  panNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  paymentTermsDays?: number;
}
