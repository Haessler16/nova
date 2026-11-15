import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { InstructionsController } from './instructions.controller';
import { InstructionsService } from './instructions.service';

@Module({
  imports: [AuthModule, TenancyModule, AuditModule],
  controllers: [InstructionsController],
  providers: [InstructionsService],
  exports: [InstructionsService],
})
export class InstructionsModule {}
