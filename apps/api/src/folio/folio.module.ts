import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { CashService } from './cash.service';
import { CashSessionController, FolioController } from './folio.controller';
import { FolioService } from './folio.service';

@Module({
  imports: [AuthModule, TenancyModule, AuditModule, InventoryModule],
  controllers: [FolioController, CashSessionController],
  providers: [FolioService, CashService],
  exports: [FolioService, CashService],
})
export class FolioModule {}
