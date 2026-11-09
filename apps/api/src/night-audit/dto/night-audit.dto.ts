import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { CALENDAR_DATE_PATTERN, IDEMPOTENCY_KEY_PATTERN } from '../../common/money/decimal';

export class CloseOperationalDayDto {
  @IsString()
  @Matches(CALENDAR_DATE_PATTERN, { message: 'operationalDate must use YYYY-MM-DD' })
  operationalDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  force?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  forceReason?: string;

  @IsString()
  @Matches(IDEMPOTENCY_KEY_PATTERN, {
    message:
      'idempotencyKey must contain 8-64 letters, digits, dots, underscores, colons or hyphens',
  })
  idempotencyKey!: string;
}

export class ReopenOperationalDayDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @IsString()
  @Matches(IDEMPOTENCY_KEY_PATTERN, {
    message:
      'idempotencyKey must contain 8-64 letters, digits, dots, underscores, colons or hyphens',
  })
  idempotencyKey!: string;
}

export class ListOperationalClosesQueryDto {
  @IsOptional()
  @IsString()
  status?: 'CLOSED' | 'REOPENED';

  @IsOptional()
  @IsString()
  @Matches(CALENDAR_DATE_PATTERN, { message: 'date must use YYYY-MM-DD' })
  date?: string;
}
