import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../access/permissions';
import { AuthenticationGuard } from '../auth/authentication.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import {
  DEV_USER_HEADER,
  ORGANIZATION_HEADER,
  PROPERTY_HEADER,
  TenantContext,
} from '../common/http/request-context';
import { PermissionsGuard } from '../tenancy/permissions.guard';
import { TenantContextGuard } from '../tenancy/tenant-context.guard';
import {
  CloseOperationalDayDto,
  ListOperationalClosesQueryDto,
  ReopenOperationalDayDto,
} from './dto/night-audit.dto';
import { NightAuditService } from './night-audit.service';

@ApiTags('operational-days')
@ApiHeader({ name: DEV_USER_HEADER, required: false })
@ApiHeader({ name: ORGANIZATION_HEADER, required: true })
@ApiHeader({ name: PROPERTY_HEADER, required: true })
@Controller('operational-days')
@UseGuards(AuthenticationGuard, TenantContextGuard, PermissionsGuard)
export class NightAuditController {
  constructor(private readonly nightAudit: NightAuditService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.NIGHT_AUDIT_READ)
  list(@Tenant() tenant: TenantContext, @Query() query: ListOperationalClosesQueryDto) {
    return this.nightAudit.list(tenant, query);
  }

  @Post('close')
  @RequirePermissions(PERMISSIONS.NIGHT_AUDIT_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  close(@Tenant() tenant: TenantContext, @Body() dto: CloseOperationalDayDto) {
    return this.nightAudit.close(tenant, dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.NIGHT_AUDIT_READ)
  get(@Tenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.nightAudit.get(tenant, id);
  }

  @Post(':id/reopen')
  @RequirePermissions(PERMISSIONS.NIGHT_AUDIT_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  reopen(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReopenOperationalDayDto,
  ) {
    return this.nightAudit.reopen(tenant, id, dto);
  }
}
