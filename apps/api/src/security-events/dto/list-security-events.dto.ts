import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListSecurityEventsQueryDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsIn(['INFO', 'WARNING', 'CRITICAL'])
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

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
