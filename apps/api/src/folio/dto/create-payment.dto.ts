import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDecimal, IsEnum, IsUUID } from 'class-validator';
import { PaymentStatus } from '../folio.entity';

export class CreatePaymentDto {
  @ApiProperty({ example: 'Credit Card', description: 'Payment method' })
  @IsString()
  method!: string;

  @ApiProperty({ example: 150.0, description: 'Payment amount' })
  @IsDecimal()
  amount!: number;

  @ApiProperty({ example: 'BRL', description: 'Currency code', default: 'BRL' })
  @IsString()
  @IsOptional()
  currencyCode?: string = 'BRL';

  @ApiProperty({ example: 'PENDING', description: 'Payment status' })
  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus = PaymentStatus.PENDING;

  @ApiProperty({ example: 'TX123456', description: 'External reference ID' })
  @IsString()
  @IsOptional()
  referenceId?: string;

  @ApiProperty({ description: 'Link to a Folio (optional)' })
  @IsUUID('4')
  @IsOptional()
  folioId?: string;

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