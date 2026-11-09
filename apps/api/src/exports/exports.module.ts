import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [AuthModule, TenancyModule, AuditModule],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}
