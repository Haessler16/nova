import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { PilotController } from './pilot.controller';
import { PilotService } from './pilot.service';

@Module({
  imports: [AuthModule, TenancyModule, AuditModule],
  controllers: [PilotController],
  providers: [PilotService],
})
export class PilotModule {}
