import { GuestDocumentType, MinorSupervision, ReservationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsBoolean,
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

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CODE_PATTERN = /^[A-Z0-9-]{4,32}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,64}$/;

export class CreateReservationDto {
  @Matches(CALENDAR_DATE_PATTERN, { message: 'checkInDate must use YYYY-MM-DD' })
  checkInDate!: string;

  @Matches(CALENDAR_DATE_PATTERN, { message: 'checkOutDate must use YYYY-MM-DD' })
  checkOutDate!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  adults!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  children?: number;

  @IsUUID()
  guestId!: string;

  @IsUUID()
  roomTypeId!: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @IsString()
  @Matches(CODE_PATTERN, {
    message: 'code must contain 4-32 uppercase letters, digits or hyphens',
  })
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @Matches(IDEMPOTENCY_KEY_PATTERN, {
    message:
      'idempotencyKey must contain 8-64 letters, digits, dots, underscores, colons or hyphens',
  })
  idempotencyKey?: string;
}

export class UpdateReservationDto {
  @IsOptional()
  @Matches(CALENDAR_DATE_PATTERN, { message: 'checkInDate must use YYYY-MM-DD' })
  checkInDate?: string;

  @IsOptional()
  @Matches(CALENDAR_DATE_PATTERN, { message: 'checkOutDate must use YYYY-MM-DD' })
  checkOutDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  adults?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  children?: number;

  @IsOptional()
  @IsUUID()
  guestId?: string;

  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class AssignReservationRoomDto {
  @IsUUID()
  roomId!: string;
}

export class CancelReservationDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}

export class ListReservationsQueryDto {
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @IsOptional()
  @IsUUID()
  guestId?: string;

  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @Matches(CALENDAR_DATE_PATTERN, { message: 'fromDate must use YYYY-MM-DD' })
  fromDate?: string;

  @IsOptional()
  @Matches(CALENDAR_DATE_PATTERN, { message: 'toDate must use YYYY-MM-DD' })
  toDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  roomNumber?: string;

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

export class ReservationAvailabilityQueryDto {
  @Matches(CALENDAR_DATE_PATTERN, { message: 'checkInDate must use YYYY-MM-DD' })
  checkInDate!: string;

  @Matches(CALENDAR_DATE_PATTERN, { message: 'checkOutDate must use YYYY-MM-DD' })
  checkOutDate!: string;

  @IsOptional()
  @IsUUID()
  roomTypeId?: string;
}

export class AddReservationGuestDto {
  @IsOptional()
  @IsUUID()
  guestId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
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
  @Matches(CALENDAR_DATE_PATTERN, { message: 'birthDate must use YYYY-MM-DD' })
  birthDate?: string;

  @IsOptional()
  @IsBoolean()
  legalIncapacity?: boolean;

  @IsOptional()
  @IsEnum(MinorSupervision)
  minorSupervision?: MinorSupervision;

  @IsOptional()
  @IsUUID()
  responsibleReservationGuestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  authorizationReference?: string;
}

export class UpdateReservationGuestDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
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
  @Matches(CALENDAR_DATE_PATTERN, { message: 'birthDate must use YYYY-MM-DD' })
  birthDate?: string;

  @IsOptional()
  @IsBoolean()
  legalIncapacity?: boolean;

  @IsOptional()
  @IsEnum(MinorSupervision)
  minorSupervision?: MinorSupervision;

  @IsOptional()
  @IsUUID()
  responsibleReservationGuestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  authorizationReference?: string;
}

export class ListReservationHistoryQueryDto {
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
