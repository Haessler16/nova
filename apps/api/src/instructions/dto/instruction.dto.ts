import {
  InstructionActionType,
  InstructionCategory,
  InstructionExecutionMoment,
  InstructionPaymentMethod,
  InstructionPriority,
  InstructionStatus,
  InstructionVisibility,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ListInstructionsQueryDto {
  @IsOptional()
  @IsEnum(InstructionStatus)
  status?: InstructionStatus;

  @IsOptional()
  @IsEnum(InstructionPriority)
  priority?: InstructionPriority;

  @IsOptional()
  @IsEnum(InstructionCategory)
  category?: InstructionCategory;

  @IsOptional()
  @IsEnum(InstructionActionType)
  actionType?: InstructionActionType;

  @IsOptional()
  @IsEnum(InstructionExecutionMoment)
  executionMoment?: InstructionExecutionMoment;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  includeCompleted?: boolean;

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

export class CreateInstructionDto {
  @IsOptional()
  @IsEnum(InstructionCategory)
  category?: InstructionCategory;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(InstructionPriority)
  priority?: InstructionPriority;

  @IsOptional()
  @IsEnum(InstructionVisibility)
  visibility?: InstructionVisibility;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceDepartment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignedDepartment?: string;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @IsOptional()
  @IsEnum(InstructionActionType)
  actionType?: InstructionActionType;

  @IsOptional()
  @IsEnum(InstructionExecutionMoment)
  executionMoment?: InstructionExecutionMoment;

  @IsOptional()
  @IsEnum(InstructionPaymentMethod)
  paymentMethod?: InstructionPaymentMethod;

  @IsOptional()
  @IsISO8601()
  actionDueAt?: string;

  @IsOptional()
  @IsISO8601()
  validFrom?: string;

  @IsOptional()
  @IsISO8601()
  validUntil?: string;
}

export class UpdateInstructionDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  body?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(InstructionPriority)
  priority?: InstructionPriority;

  @IsOptional()
  @IsEnum(InstructionVisibility)
  visibility?: InstructionVisibility;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignedDepartment?: string;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @IsOptional()
  @IsISO8601()
  actionDueAt?: string;

  @IsOptional()
  @IsISO8601()
  validFrom?: string;

  @IsOptional()
  @IsISO8601()
  validUntil?: string;
}

export class InstructionTransitionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ParseSourceNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceSystem?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceDepartment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalReference?: string;
}

export class ConfirmSuggestionDto {
  @IsEnum(InstructionCategory)
  category!: InstructionCategory;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @IsEnum(InstructionPriority)
  priority?: InstructionPriority;

  @IsOptional()
  @IsIn([InstructionStatus.NEW, InstructionStatus.NEEDS_CLARIFICATION])
  status?: InstructionStatus;

  @IsOptional()
  @IsEnum(InstructionVisibility)
  visibility?: InstructionVisibility;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignedDepartment?: string;

  @IsOptional()
  @IsEnum(InstructionActionType)
  actionType?: InstructionActionType;

  @IsOptional()
  @IsEnum(InstructionExecutionMoment)
  executionMoment?: InstructionExecutionMoment;

  @IsOptional()
  @IsEnum(InstructionPaymentMethod)
  paymentMethod?: InstructionPaymentMethod;

  /** Accepted so clients can send parser output back unchanged. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourcePhrase?: string;

  /** Accepted for round-tripping; the server never trusts it as approval. */
  @IsOptional()
  @IsBoolean()
  requiresHumanConfirmation?: boolean;

  /** Accepted for round-tripping; recomputed server-side for deduplication. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}

export class ConfirmSourceSuggestionsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ConfirmSuggestionDto)
  suggestions!: ConfirmSuggestionDto[];
}

export class ListGuestNotesQueryDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  includeInactive?: boolean;
}

export class CreateGuestNoteDto {
  @IsOptional()
  @IsEnum(InstructionCategory)
  category?: InstructionCategory;

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  @IsEnum(InstructionPriority)
  priority?: InstructionPriority;

  @IsOptional()
  @IsEnum(InstructionVisibility)
  visibility?: InstructionVisibility;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  purpose?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class UpdateGuestNoteDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  body?: string;

  @IsOptional()
  @IsEnum(InstructionPriority)
  priority?: InstructionPriority;

  @IsOptional()
  @IsEnum(InstructionVisibility)
  visibility?: InstructionVisibility;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  purpose?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
