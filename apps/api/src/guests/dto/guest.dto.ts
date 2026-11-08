import { GuestDocumentType, RecordStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const PHONE_PATTERN = /^\+?[0-9 ()-]{6,32}$/;

export class CreateGuestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'phone must be a phone-like value' })
  phone?: string;

  @IsOptional()
  @IsEnum(GuestDocumentType)
  documentType?: GuestDocumentType;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  documentNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateGuestDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'phone must be a phone-like value' })
  phone?: string;

  @IsOptional()
  @IsEnum(GuestDocumentType)
  documentType?: GuestDocumentType;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  documentNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsIn([RecordStatus.ACTIVE, RecordStatus.DISABLED])
  status?: RecordStatus;
}

export class ListGuestsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;

  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
