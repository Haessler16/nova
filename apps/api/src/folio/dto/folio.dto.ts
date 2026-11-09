import { CashMovementType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  CALENDAR_DATE_PATTERN,
  CURRENCY_PATTERN,
  IDEMPOTENCY_KEY_PATTERN,
  MONEY_PATTERN,
} from '../../common/money/decimal';

export class CreateFolioDto {
  @IsOptional()
  @IsUUID()
  stayId?: string;

  @IsOptional()
  @IsUUID()
  reservationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsString()
  @Matches(IDEMPOTENCY_KEY_PATTERN, {
    message:
      'idempotencyKey must contain 8-64 letters, digits, dots, underscores, colons or hyphens',
  })
  idempotencyKey!: string;
}

export class AddFolioChargeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  description!: string;

  @IsString()
  @Matches(MONEY_PATTERN, { message: 'amount must be a decimal string with up to 2 decimals' })
  amount!: string;

  @IsOptional()
  @IsString()
  @Matches(CURRENCY_PATTERN, { message: 'currencyCode must use three uppercase letters' })
  currencyCode?: string;

  @IsString()
  @Matches(IDEMPOTENCY_KEY_PATTERN, {
    message:
      'idempotencyKey must contain 8-64 letters, digits, dots, underscores, colons or hyphens',
  })
  idempotencyKey!: string;
}

export class VoidFolioChargeDto {
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

export class RecordPaymentDto {
  @IsString()
  @Matches(MONEY_PATTERN, { message: 'amount must be a decimal string with up to 2 decimals' })
  amount!: string;

  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,31}$/, {
    message: 'method must be an uppercase code such as CASH, CREDIT_CARD or BANK_TRANSFER',
  })
  method!: string;

  @IsOptional()
  @IsString()
  @Matches(CURRENCY_PATTERN, { message: 'currencyCode must use three uppercase letters' })
  currencyCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  referenceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsString()
  @Matches(IDEMPOTENCY_KEY_PATTERN, {
    message:
      'idempotencyKey must contain 8-64 letters, digits, dots, underscores, colons or hyphens',
  })
  idempotencyKey!: string;
}

export class CancelFolioDto {
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

export class ListFoliosQueryDto {
  @IsOptional()
  @IsString()
  status?: 'OPEN' | 'SETTLED' | 'CANCELLED';

  @IsOptional()
  @IsUUID()
  stayId?: string;

  @IsOptional()
  @IsUUID()
  reservationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  search?: string;

  @IsOptional()
  @IsString()
  @Matches(CALENDAR_DATE_PATTERN, { message: 'date must use YYYY-MM-DD' })
  date?: string;
}

export class OpenCashSessionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(CALENDAR_DATE_PATTERN, { message: 'operationalDate must use YYYY-MM-DD' })
  operationalDate!: string;

  @IsString()
  @Matches(MONEY_PATTERN, {
    message: 'openingAmount must be a decimal string with up to 2 decimals',
  })
  openingAmount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsString()
  @Matches(IDEMPOTENCY_KEY_PATTERN, {
    message:
      'idempotencyKey must contain 8-64 letters, digits, dots, underscores, colons or hyphens',
  })
  idempotencyKey!: string;
}

export class RecordCashMovementDto {
  @IsEnum(CashMovementType)
  type!: CashMovementType;

  @IsString()
  @Matches(MONEY_PATTERN, { message: 'amount must be a decimal string with up to 2 decimals' })
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsString()
  @Matches(IDEMPOTENCY_KEY_PATTERN, {
    message:
      'idempotencyKey must contain 8-64 letters, digits, dots, underscores, colons or hyphens',
  })
  idempotencyKey!: string;
}

export class CloseCashSessionDto {
  @IsString()
  @Matches(MONEY_PATTERN, {
    message: 'closingAmount must be a decimal string with up to 2 decimals',
  })
  closingAmount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  varianceReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsString()
  @Matches(IDEMPOTENCY_KEY_PATTERN, {
    message:
      'idempotencyKey must contain 8-64 letters, digits, dots, underscores, colons or hyphens',
  })
  idempotencyKey!: string;
}

export class ListCashSessionsQueryDto {
  @IsOptional()
  @IsString()
  status?: 'OPEN' | 'CLOSED';

  @IsOptional()
  @IsString()
  @Matches(CALENDAR_DATE_PATTERN, { message: 'date must use YYYY-MM-DD' })
  date?: string;
}
