import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { FrontOfficeController } from './front-office.controller';
import { FrontOfficeService } from './front-office.service';
import { PropertyLoader } from './infrastructure/property-loader';
import { CheckInUseCase } from './application/check-in.use-case';

@Module({
  imports: [AuthModule, TenancyModule, AuditModule, InventoryModule],
  controllers: [FrontOfficeController],
  providers: [FrontOfficeService, PropertyLoader, CheckInUseCase],
})
export class FrontOfficeModule {}
