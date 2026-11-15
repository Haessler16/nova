import {
  Body,
  Controller,
  Delete,
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
import {
  AddReservationGuestDto,
  AssignReservationRoomDto,
  CancelReservationDto,
  CreateReservationDto,
  ListReservationHistoryQueryDto,
  ListReservationsQueryDto,
  ReservationAvailabilityQueryDto,
  UpdateReservationDto,
  UpdateReservationGuestDto,
} from './dto/reservation.dto';
import { ReservationPartyService } from './reservation-party.service';
import { ReservationsService } from './reservations.service';

@ApiTags('reservations')
@ApiHeader({ name: DEV_USER_HEADER, required: false })
@ApiHeader({ name: ORGANIZATION_HEADER, required: true })
@ApiHeader({ name: PROPERTY_HEADER, required: true })
@Controller('reservations')
@UseGuards(AuthenticationGuard, TenantContextGuard, PermissionsGuard)
export class ReservationsController {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly party: ReservationPartyService,
  ) {}

  @Get('availability')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_READ)
  availability(@Tenant() tenant: TenantContext, @Query() query: ReservationAvailabilityQueryDto) {
    return this.reservations.availability(tenant, query);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.RESERVATIONS_READ)
  list(@Tenant() tenant: TenantContext, @Query() query: ListReservationsQueryDto) {
    return this.reservations.list(tenant, query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.RESERVATIONS_MANAGE)
  create(@Tenant() tenant: TenantContext, @Body() dto: CreateReservationDto) {
    return this.reservations.create(tenant, dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_READ)
  get(@Tenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.reservations.get(tenant, id);
  }

  @Get(':id/party')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_READ, PERMISSIONS.GUESTS_READ)
  getParty(@Tenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.party.get(tenant, id);
  }

  @Post(':id/party')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_MANAGE, PERMISSIONS.GUESTS_MANAGE)
  addPartyGuest(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AddReservationGuestDto,
  ) {
    return this.party.add(tenant, id, dto);
  }

  @Patch(':id/party/:reservationGuestId')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_MANAGE, PERMISSIONS.GUESTS_MANAGE)
  updatePartyGuest(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('reservationGuestId', new ParseUUIDPipe()) reservationGuestId: string,
    @Body() dto: UpdateReservationGuestDto,
  ) {
    return this.party.update(tenant, id, reservationGuestId, dto);
  }

  @Delete(':id/party/:reservationGuestId')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_MANAGE, PERMISSIONS.GUESTS_MANAGE)
  removePartyGuest(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('reservationGuestId', new ParseUUIDPipe()) reservationGuestId: string,
  ) {
    return this.party.remove(tenant, id, reservationGuestId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_MANAGE)
  update(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservations.update(tenant, id, dto);
  }

  @Post(':id/room-assignment')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_MANAGE)
  assignRoom(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignReservationRoomDto,
  ) {
    return this.reservations.assignRoom(tenant, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_MANAGE)
  cancel(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CancelReservationDto,
  ) {
    return this.reservations.cancel(tenant, id, dto);
  }

  @Get(':id/history')
  @RequirePermissions(PERMISSIONS.RESERVATIONS_READ)
  history(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ListReservationHistoryQueryDto,
  ) {
    return this.reservations.getHistory(tenant, id, query);
  }
}
