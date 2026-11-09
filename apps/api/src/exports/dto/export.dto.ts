import { FolioStatus, RecordStatus, ReservationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ExportGuestsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

export class ExportReservationsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @IsOptional()
  @Matches(CALENDAR_DATE, { message: 'fromDate must be YYYY-MM-DD' })
  fromDate?: string;

  @IsOptional()
  @Matches(CALENDAR_DATE, { message: 'toDate must be YYYY-MM-DD' })
  toDate?: string;
}

export class ExportFoliosQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsEnum(FolioStatus)
  status?: FolioStatus;

  @IsOptional()
  @Matches(CALENDAR_DATE, { message: 'date must be YYYY-MM-DD' })
  date?: string;
}
