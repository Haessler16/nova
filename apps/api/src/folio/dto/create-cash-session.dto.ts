import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDecimal, IsEnum, IsUUID, IsDate } from 'class-validator';
import { CashSessionStatus } from '../folio.entity';

export class CreateCashSessionDto {
  @ApiProperty({ example: 'Dia operativo 09/11', description: 'Cash session name' })
  @IsString()
  name!: string;

  @ApiProperty({ example: '2026-11-09', description: 'Operational date' })
  @IsDate()
  operationalDate!: Date;

  @ApiProperty({ example: 500.0, description: 'Opening amount in currency' })
  @IsDecimal()
  openingAmount!: number;

  @ApiProperty({ example: 'BRL', description: 'Currency code', default: 'BRL' })
  @IsString()
  @IsOptional()
  currencyCode?: string = 'BRL';

  @ApiProperty({ description: 'User ID who opened the session' })
  @IsUUID('4')
  @IsOptional()
  openingByUserId?: string;

  @ApiProperty({ enum: ['OPEN', 'CLOSED'], description: 'Session status' })
  @IsEnum(CashSessionStatus)
  @IsOptional()
  status?: CashSessionStatus = CashSessionStatus.OPEN;
}