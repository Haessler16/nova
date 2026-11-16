import { IsOptional, IsUUID } from 'class-validator';

export class CreateRoomAssignmentLeaseDto {
  @IsOptional()
  @IsUUID()
  reservationId?: string;
}
