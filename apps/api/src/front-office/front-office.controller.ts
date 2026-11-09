import {
  Body,
  Controller,
  Get,
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
  CheckOutDto,
  CreateIncidentDto,
  FrontOfficeOverviewQueryDto,
  ListIncidentsQueryDto,
  MoveStayRoomDto,
  NoShowDto,
  ResolveIncidentDto,
} from './dto/front-office.dto';
import { FrontOfficeService } from './front-office.service';

@ApiTags('front-office')
@ApiHeader({ name: DEV_USER_HEADER, required: false })
@ApiHeader({ name: ORGANIZATION_HEADER, required: true })
@ApiHeader({ name: PROPERTY_HEADER, required: true })
@Controller('front-office')
@UseGuards(AuthenticationGuard, TenantContextGuard, PermissionsGuard)
export class FrontOfficeController {
  constructor(private readonly frontOffice: FrontOfficeService) {}

  @Get('overview')
  @RequirePermissions(PERMISSIONS.FRONT_OFFICE_READ)
  overview(@Tenant() tenant: TenantContext, @Query() query: FrontOfficeOverviewQueryDto) {
    return this.frontOffice.overview(tenant, query);
  }

  @Post('reservations/:id/check-in')
  @RequirePermissions(PERMISSIONS.FRONT_OFFICE_MANAGE)
  checkIn(@Tenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.frontOffice.checkIn(tenant, id);
  }

  @Post('reservations/:id/no-show')
  @RequirePermissions(PERMISSIONS.FRONT_OFFICE_MANAGE)
  noShow(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: NoShowDto,
  ) {
    return this.frontOffice.noShow(tenant, id, dto);
  }

  @Post('stays/:id/check-out')
  @RequirePermissions(PERMISSIONS.FRONT_OFFICE_MANAGE)
  checkOut(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CheckOutDto,
  ) {
    return this.frontOffice.checkOut(tenant, id, dto);
  }

  @Post('stays/:id/room-move')
  @RequirePermissions(PERMISSIONS.FRONT_OFFICE_MANAGE)
  moveRoom(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MoveStayRoomDto,
  ) {
    return this.frontOffice.moveRoom(tenant, id, dto);
  }

  @Get('incidents')
  @RequirePermissions(PERMISSIONS.INCIDENTS_READ)
  listIncidents(@Tenant() tenant: TenantContext, @Query() query: ListIncidentsQueryDto) {
    return this.frontOffice.listIncidents(tenant, query);
  }

  @Post('incidents')
  @RequirePermissions(PERMISSIONS.INCIDENTS_MANAGE)
  createIncident(@Tenant() tenant: TenantContext, @Body() dto: CreateIncidentDto) {
    return this.frontOffice.createIncident(tenant, dto);
  }

  @Post('incidents/:id/resolve')
  @RequirePermissions(PERMISSIONS.INCIDENTS_MANAGE)
  resolveIncident(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ResolveIncidentDto,
  ) {
    return this.frontOffice.resolveIncident(tenant, id, dto);
  }
}
