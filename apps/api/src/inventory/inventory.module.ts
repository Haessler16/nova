import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { InventoryController } from './inventory.controller';
import { RoomBlocksService } from './room-blocks.service';
import { RoomStateService } from './room-state.service';
import { RoomTypesService } from './room-types.service';
import { RoomsService } from './rooms.service';

@Module({
  imports: [AuthModule, TenancyModule, AuditModule],
  controllers: [InventoryController],
  providers: [RoomStateService, RoomTypesService, RoomsService, RoomBlocksService],
})
export class InventoryModule {}
