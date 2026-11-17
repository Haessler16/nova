import { IncidentSeverity, IncidentType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
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

export class FrontOfficeOverviewQueryDto {
  @IsOptional()
  @Matches(CALENDAR_DATE_PATTERN, { message: 'date must use YYYY-MM-DD' })
  date?: string;
}

export class CheckOutDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /** Close the account(s) in the same transaction. Defaults to true. */
  @IsOptional()
  @IsBoolean()
  closeFolios?: boolean;

  /**
   * Hotel policy decides whether a pending balance blocks checkout. The
   * reversible default is to block; an operator can authorize the exception
   * explicitly and it is audited with a reason (OPEN QUESTION, ADR-055).
   */
  @IsOptional()
  @IsBoolean()
  allowOutstandingBalance?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  balanceReason?: string;
}

export class MoveStayRoomDto {
  @IsUUID()
  roomId!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}

export class NoShowDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}

export class CreateIncidentDto {
  @IsOptional()
  @IsEnum(IncidentType)
  type?: IncidentType;

  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  description!: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @IsUUID()
  reservationId?: string;

  @IsOptional()
  @IsUUID()
  stayId?: string;
}

export class ResolveIncidentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  resolution!: string;
}

export class ListIncidentsQueryDto {
  @IsOptional()
  @IsString()
  status?: 'OPEN' | 'RESOLVED';

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @IsUUID()
  reservationId?: string;

  @IsOptional()
  @IsUUID()
  stayId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
