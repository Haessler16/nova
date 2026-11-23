import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { SecurityEventsModule } from '../security-events/security-events.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { AdminController } from './admin.controller';
import { AdminGuards } from './admin.guards';
import { AdminService } from './admin.service';

@Module({
  imports: [AuditModule, AuthModule, SecurityEventsModule, TenancyModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuards],
})
export class AdminModule {}
