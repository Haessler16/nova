import { HousekeepingState } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class HousekeepingTransitionDto {
  @IsEnum(HousekeepingState)
  state!: HousekeepingState;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
