import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const EXPORT_FORMATS = ['PDF', 'CSV'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ReportFiltersDto {
  @IsString()
  @MaxLength(10)
  @Matches(CALENDAR_DATE, { message: 'from must use YYYY-MM-DD.' })
  from!: string;

  @IsString()
  @MaxLength(10)
  @Matches(CALENDAR_DATE, { message: 'to must use YYYY-MM-DD.' })
  to!: string;
}

export class RunReportDto {
  @IsObject()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => ReportFiltersDto)
  filters!: ReportFiltersDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class ExportReportDto {
  @IsIn(EXPORT_FORMATS)
  format!: ExportFormat;

  @IsObject()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => ReportFiltersDto)
  filters!: ReportFiltersDto;
}
