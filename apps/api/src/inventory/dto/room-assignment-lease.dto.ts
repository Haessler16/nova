import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRoomAssignmentLeaseDto {
  @IsOptional()
  @IsUUID()
  reservationId?: string;
}

export class ReleaseRoomAssignmentLeaseDto {
  @IsUUID()
  leaseId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class TransferRoomAssignmentLeaseDto {
  @IsUUID()
  toRoomId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
