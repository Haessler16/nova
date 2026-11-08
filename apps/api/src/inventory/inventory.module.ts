import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ObservabilityModule } from '../observability/observability.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { InventoryController } from './inventory.controller';
import { RoomBlockExpiryScheduler } from './room-block-expiry.scheduler';
import { RoomBlocksService } from './room-blocks.service';
import { RoomStateService } from './room-state.service';
import { RoomTypesService } from './room-types.service';
import { RoomsService } from './rooms.service';

@Module({
  imports: [AuthModule, TenancyModule, AuditModule, ObservabilityModule],
  controllers: [InventoryController],
  providers: [
    RoomStateService,
    RoomTypesService,
    RoomsService,
    RoomBlocksService,
    RoomBlockExpiryScheduler,
  ],
  exports: [RoomStateService, RoomBlockExpiryScheduler],
})
export class InventoryModule {}
