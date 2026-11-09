import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { GuestImportService } from './guest-import.service';
import { GuestsController } from './guests.controller';
import { GuestsService } from './guests.service';

@Module({
  imports: [AuthModule, TenancyModule, AuditModule],
  controllers: [GuestsController],
  providers: [GuestsService, GuestImportService],
  exports: [GuestsService],
})
export class GuestsModule {}
