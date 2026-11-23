import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { FrontOfficeController } from './front-office.controller';
import { FrontOfficeService } from './front-office.service';
import { PropertyLoader } from './infrastructure/property-loader';
import { CheckInUseCase } from './application/check-in.use-case';
import { CheckInReadinessQuery } from './application/check-in-readiness.query';
import { CheckOutUseCase } from './application/check-out.use-case';
import { OverviewQuery } from './application/overview.query';
import { RoomMoveUseCase } from './application/room-move.use-case';
import { NoShowUseCase } from './application/no-show.use-case';
import { IncidentsService } from './application/incidents.service';

@Module({
  imports: [AuthModule, TenancyModule, AuditModule, InventoryModule],
  controllers: [FrontOfficeController],
  providers: [
    FrontOfficeService,
    PropertyLoader,
    CheckInUseCase,
    CheckInReadinessQuery,
    CheckOutUseCase,
    OverviewQuery,
    RoomMoveUseCase,
    NoShowUseCase,
    IncidentsService,
  ],
})
export class FrontOfficeModule {}
