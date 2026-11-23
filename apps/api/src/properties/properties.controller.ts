import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
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
import { Clock } from '../common/time/clock';
import { computeOperationalDay } from '../operational-day/operational-day';
import { PermissionsGuard } from '../tenancy/permissions.guard';
import { TenantContextGuard } from '../tenancy/tenant-context.guard';
import { TenancyService } from '../tenancy/tenancy.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertySettingsDto } from './dto/update-property-settings.dto';
import { PropertiesService } from './properties.service';

@ApiTags('properties')
@ApiHeader({ name: DEV_USER_HEADER, required: false })
@ApiHeader({ name: ORGANIZATION_HEADER, required: true })
@Controller('properties')
@UseGuards(AuthenticationGuard, TenantContextGuard, PermissionsGuard)
export class PropertiesController {
  constructor(
    private readonly tenancy: TenancyService,
    private readonly properties: PropertiesService,
    private readonly clock: Clock,
  ) {}

  @Get()
  async list(@Tenant() tenant: TenantContext) {
    return { items: await this.tenancy.listPropertiesForContext(tenant) };
  }

  @Get('current')
  @ApiHeader({ name: PROPERTY_HEADER, required: true })
  current(@Tenant() tenant: TenantContext) {
    return this.properties.getCurrent(tenant);
  }

  @Get('current/operational-day')
  @ApiHeader({ name: PROPERTY_HEADER, required: true })
  async operationalDay(@Tenant() tenant: TenantContext) {
    const property = await this.properties.getCurrent(tenant);
    return computeOperationalDay(this.clock.now(), property.timezone, property.operationalDayStart);
  }

  @Patch('current')
  @ApiHeader({ name: PROPERTY_HEADER, required: true })
  @RequirePermissions(PERMISSIONS.PROPERTY_MANAGE)
  updateCurrent(@Tenant() tenant: TenantContext, @Body() dto: UpdatePropertySettingsDto) {
    return this.properties.updateSettings(tenant, dto);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ORGANIZATION_PROPERTIES_MANAGE)
  create(@Tenant() tenant: TenantContext, @Body() dto: CreatePropertyDto) {
    return this.properties.create(tenant, dto);
  }
}
