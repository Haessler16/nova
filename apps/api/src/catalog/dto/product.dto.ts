import { FolioProductCategory } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CURRENCY_PATTERN, MONEY_PATTERN } from '../../common/money/decimal';

const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$/;
const UNIT_PATTERN = /^[A-Za-z]{1,8}$/;

export class CreateProductDto {
  @IsString()
  @Matches(SKU_PATTERN, {
    message: 'sku must contain 2-32 letters, digits, dots, underscores or hyphens',
  })
  sku!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsOptional()
  @IsEnum(FolioProductCategory)
  category?: FolioProductCategory;

  @IsOptional()
  @IsString()
  @Matches(UNIT_PATTERN, { message: 'unit must use up to 8 letters' })
  unit?: string;

  @IsString()
  @Matches(MONEY_PATTERN, { message: 'unitAmount must be a decimal string with up to 2 decimals' })
  unitAmount!: string;

  @IsOptional()
  @IsString()
  @Matches(CURRENCY_PATTERN, { message: 'currencyCode must use three uppercase letters' })
  currencyCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsOptional()
  @IsEnum(FolioProductCategory)
  category?: FolioProductCategory;

  @IsOptional()
  @IsString()
  @Matches(UNIT_PATTERN, { message: 'unit must use up to 8 letters' })
  unit?: string;

  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN, { message: 'unitAmount must be a decimal string with up to 2 decimals' })
  unitAmount?: string;

  @IsOptional()
  @IsString()
  @Matches(CURRENCY_PATTERN, { message: 'currencyCode must use three uppercase letters' })
  currencyCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListProductsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsEnum(FolioProductCategory)
  category?: FolioProductCategory;

  @IsOptional()
  @IsIn(['true', 'false'], { message: 'isActive must be true or false' })
  isActive?: 'true' | 'false';
}
