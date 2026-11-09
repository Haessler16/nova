import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { NightAuditController } from './night-audit.controller';
import { NightAuditService } from './night-audit.service';

@Module({
  imports: [AuthModule, TenancyModule, AuditModule],
  controllers: [NightAuditController],
  providers: [NightAuditService],
})
export class NightAuditModule {}
