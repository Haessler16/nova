import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDecimal, IsEnum, IsUUID } from 'class-validator';
import { FolioStatus } from '../folio.entity';

export class CreateFolioDto {
  @ApiProperty({ example: 'Room service', description: 'Charge concept' })
  @IsString()
  concept!: string;

  @ApiProperty({ example: 150.0, description: 'Charge amount' })
  @IsDecimal()
  amount!: number;

  @ApiProperty({ example: 'BRL', description: 'Currency code', default: 'BRL' })
  @IsString()
  @IsOptional()
  currencyCode?: string = 'BRL';

  @ApiProperty({ example: 'PENDING', description: 'Folio status' })
  @IsEnum(FolioStatus)
  @IsOptional()
  status?: FolioStatus = FolioStatus.PENDING;

  @ApiProperty({ example: 'STD-101', description: 'Optional room number' })
  @IsString()
  @IsOptional()
  number?: string;

  @ApiProperty({ description: 'Link to a Stay (optional)' })
  @IsUUID('4')
  @IsOptional()
  stayId?: string;

  @ApiProperty({ description: 'Link to a Reservation (optional)' })
  @IsUUID('4')
  @IsOptional()
  reservationId?: string;

  @ApiProperty({ description: 'Optional description' })
  @IsString()
  @IsOptional()
  description?: string;
}