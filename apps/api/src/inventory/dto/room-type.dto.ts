import { RecordStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRoomTypeDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,24}$/, {
    message: 'code must contain 1-24 letters, digits, hyphens or underscores',
  })
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  capacityAdults?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  capacityChildren?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bedType?: string;
}

export class UpdateRoomTypeDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  capacityAdults?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  capacityChildren?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bedType?: string;

  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

export class ListRoomTypesQueryDto {
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
