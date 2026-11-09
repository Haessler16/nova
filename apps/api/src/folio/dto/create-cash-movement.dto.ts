import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDecimal, IsEnum, IsUUID, IsDate } from 'class-validator';
import { CashMovementType } from '../folio.entity';

export class CreateCashMovementDto {
  @ApiProperty({ enum: ['OPENING', 'CLOSING', 'SALE', 'REFUND', 'CASH_IN', 'CASH_OUT'], description: 'Movement type' })
  @IsString()
  type!: string;

  @ApiProperty({ example: 100.0, description: 'Movement amount' })
  @IsDecimal()
  amount!: number;

  @ApiProperty({ example: 'BRL', description: 'Currency code', default: 'BRL' })
  @IsString()
  @IsOptional()
  currencyCode?: string = 'BRL';

  @ApiProperty({ description: 'Optional movement description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'User ID who recorded the movement' })
  @IsUUID('4')
  @IsOptional()
  recordedByUserId?: string;
}