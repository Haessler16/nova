import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { GuestNotesService } from './guest-notes.service';
import { InstructionsController } from './instructions.controller';
import { InstructionsService } from './instructions.service';

@Module({
  imports: [AuthModule, TenancyModule, AuditModule],
  controllers: [InstructionsController],
  providers: [InstructionsService, GuestNotesService],
  exports: [InstructionsService],
})
export class InstructionsModule {}
