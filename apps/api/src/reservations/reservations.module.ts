import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { ReservationsController } from './reservations.controller';
import { ReservationLifecycleService } from './reservation-lifecycle.service';
import { ReservationPartyService } from './reservation-party.service';
import { ReservationGuards } from './reservations.guards';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [AuthModule, TenancyModule, AuditModule, InventoryModule],
  controllers: [ReservationsController],
  providers: [
    ReservationsService,
    ReservationLifecycleService,
    ReservationGuards,
    ReservationPartyService,
  ],
  exports: [ReservationsService, ReservationPartyService],
})
export class ReservationsModule {}
