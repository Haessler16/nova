import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CreateGuestDto, ListGuestsQueryDto, UpdateGuestDto } from './dto/guest.dto';
import { GuestsService } from './guests.service';

@ApiTags('guests')
@ApiHeader({ name: DEV_USER_HEADER, required: false })
@ApiHeader({ name: ORGANIZATION_HEADER, required: true })
@ApiHeader({ name: PROPERTY_HEADER, required: true })
@Controller('guests')
@UseGuards(AuthenticationGuard, TenantContextGuard, PermissionsGuard)
export class GuestsController {
  constructor(private readonly guests: GuestsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.GUESTS_READ)
  list(@Tenant() tenant: TenantContext, @Query() query: ListGuestsQueryDto) {
    return this.guests.list(tenant, query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.GUESTS_MANAGE)
  create(@Tenant() tenant: TenantContext, @Body() dto: CreateGuestDto) {
    return this.guests.create(tenant, dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.GUESTS_READ)
  get(@Tenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.guests.get(tenant, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.GUESTS_MANAGE)
  update(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateGuestDto,
  ) {
    return this.guests.update(tenant, id, dto);
  }
}
