import { PilotFeedbackCategory } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePilotFeedbackDto {
  @IsEnum(PilotFeedbackCategory)
  category!: PilotFeedbackCategory;

  @IsString()
  @MinLength(8)
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}

export class ListPilotFeedbackQueryDto {
  @IsOptional()
  @IsIn(['OPEN', 'REVIEWED', 'ARCHIVED'])
  status?: 'OPEN' | 'REVIEWED' | 'ARCHIVED';
}
