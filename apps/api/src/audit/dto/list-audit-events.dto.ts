import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ListAuditEventsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string;

  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @IsOptional()
  @Matches(CALENDAR_DATE, { message: 'fromDate must be YYYY-MM-DD' })
  fromDate?: string;

  @IsOptional()
  @Matches(CALENDAR_DATE, { message: 'toDate must be YYYY-MM-DD' })
  toDate?: string;

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
