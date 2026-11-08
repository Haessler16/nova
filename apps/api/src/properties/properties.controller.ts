import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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
import { TenancyService } from '../tenancy/tenancy.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertiesService } from './properties.service';

@ApiTags('properties')
@ApiHeader({ name: DEV_USER_HEADER, required: true })
@ApiHeader({ name: ORGANIZATION_HEADER, required: true })
@Controller('properties')
@UseGuards(AuthenticationGuard, TenantContextGuard, PermissionsGuard)
export class PropertiesController {
  constructor(
    private readonly tenancy: TenancyService,
    private readonly properties: PropertiesService,
  ) {}

  @Get()
  async list(@Tenant() tenant: TenantContext) {
    return { items: await this.tenancy.listPropertiesForContext(tenant) };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PROPERTY_MANAGE)
  @ApiHeader({ name: PROPERTY_HEADER, required: true })
  create(@Tenant() tenant: TenantContext, @Body() dto: CreatePropertyDto) {
    return this.properties.create(tenant, dto);
  }
}
