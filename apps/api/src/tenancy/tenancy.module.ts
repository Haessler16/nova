import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PermissionsGuard } from './permissions.guard';
import { TenantContextGuard } from './tenant-context.guard';
import { TenancyService } from './tenancy.service';

@Module({
  imports: [AuthModule],
  providers: [TenancyService, TenantContextGuard, PermissionsGuard],
  exports: [TenancyService, TenantContextGuard, PermissionsGuard],
})
export class TenancyModule {}
