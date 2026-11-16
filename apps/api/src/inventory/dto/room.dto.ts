import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HousekeepingState, RecordStatus, RoomOperationalState } from '@prisma/client';

export class CreateRoomDto {
  @IsString()
  @Matches(/^[A-Za-z0-9._/-]{1,32}$/, {
    message: 'number must contain 1-32 letters, digits, dots, underscores, slashes or hyphens',
  })
  number!: string;

  @IsUUID()
  roomTypeId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  floor?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  building?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  attributes?: string[];
}

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9._/-]{1,32}$/, {
    message: 'number must contain 1-32 letters, digits, dots, underscores, slashes or hyphens',
  })
  number?: string;

  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  floor?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  building?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  attributes?: string[];

  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

export class ListRoomsQueryDto {
  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  floor?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  building?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  minCapacity?: number;

  @IsOptional()
  @IsIn(['VACANT', 'OCCUPIED'])
  occupancy?: 'VACANT' | 'OCCUPIED';

  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;

  @IsOptional()
  @IsEnum(HousekeepingState)
  housekeepingState?: HousekeepingState;

  @IsOptional()
  @IsEnum(RoomOperationalState)
  operationalState?: RoomOperationalState;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  search?: string;

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
