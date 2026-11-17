import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Sse,
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
import { HousekeepingTransitionDto } from './dto/housekeeping-transition.dto';
import {
  CreateRoomBlockDto,
  ListRoomHistoryQueryDto,
  ReleaseRoomBlockDto,
} from './dto/room-block.dto';
import { CreateRoomDto, ListRoomsQueryDto, UpdateRoomDto } from './dto/room.dto';
import { CreateRoomAssignmentLeaseDto } from './dto/room-assignment-lease.dto';
import { ReleaseRoomAssignmentLeaseDto } from './dto/room-assignment-lease.dto';
import { TransferRoomAssignmentLeaseDto } from './dto/room-assignment-lease.dto';
import { CreateRoomTypeDto, ListRoomTypesQueryDto, UpdateRoomTypeDto } from './dto/room-type.dto';
import { requirePropertyContext } from './room-state.service';
import { RoomAssignmentLeasesService } from './room-assignment-leases.service';
import { RoomEventsService } from './room-events.service';
import { RoomBlocksService } from './room-blocks.service';
import { RoomTypesService } from './room-types.service';
import { RoomsService } from './rooms.service';

@ApiTags('inventory')
@ApiHeader({ name: DEV_USER_HEADER, required: false })
@ApiHeader({ name: ORGANIZATION_HEADER, required: true })
@ApiHeader({ name: PROPERTY_HEADER, required: true })
@Controller('inventory')
@UseGuards(AuthenticationGuard, TenantContextGuard, PermissionsGuard)
export class InventoryController {
  constructor(
    private readonly roomTypes: RoomTypesService,
    private readonly rooms: RoomsService,
    private readonly blocks: RoomBlocksService,
    private readonly leases: RoomAssignmentLeasesService,
    private readonly events: RoomEventsService,
  ) {}

  @Get('room-types')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  listRoomTypes(@Tenant() tenant: TenantContext, @Query() query: ListRoomTypesQueryDto) {
    return this.roomTypes.list(tenant, query);
  }

  @Post('room-types')
  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  createRoomType(@Tenant() tenant: TenantContext, @Body() dto: CreateRoomTypeDto) {
    return this.roomTypes.create(tenant, dto);
  }

  @Get('room-types/:id')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  getRoomType(@Tenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.roomTypes.get(tenant, id);
  }

  @Patch('room-types/:id')
  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  updateRoomType(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoomTypeDto,
  ) {
    return this.roomTypes.update(tenant, id, dto);
  }

  @Get('rooms')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  listRooms(@Tenant() tenant: TenantContext, @Query() query: ListRoomsQueryDto) {
    return this.rooms.list(tenant, query);
  }

  @Post('rooms')
  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  createRoom(@Tenant() tenant: TenantContext, @Body() dto: CreateRoomDto) {
    return this.rooms.create(tenant, dto);
  }

  /**
   * Server-sent room rack updates. Declared before `rooms/:id` so the literal
   * path is not consumed by the UUID parameter route. Events are notifications
   * only: clients refetch the rack, which keeps PostgreSQL authoritative.
   */
  @Sse('rooms/updates')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  roomUpdates(@Tenant() tenant: TenantContext) {
    const propertyId = requirePropertyContext(tenant);
    return this.events.stream(tenant.organizationId, propertyId);
  }

  @Get('rooms/:id')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  getRoom(@Tenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.rooms.get(tenant, id);
  }

  @Patch('rooms/:id')
  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  updateRoom(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.rooms.update(tenant, id, dto);
  }

  @Post('rooms/:id/housekeeping-transitions')
  @RequirePermissions(PERMISSIONS.HOUSEKEEPING_MANAGE)
  transitionHousekeeping(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe) id: string,
    @Body() dto: HousekeepingTransitionDto,
  ) {
    return this.rooms.transitionHousekeeping(tenant, id, dto);
  }

  @Post('rooms/:id/assignment-leases')
  @RequirePermissions(PERMISSIONS.FRONT_OFFICE_MANAGE)
  acquireAssignmentLease(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateRoomAssignmentLeaseDto,
  ) {
    return this.leases.acquire(tenant, id, dto.reservationId);
  }

  @Post('rooms/:id/assignment-leases/:leaseId/renew')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.FRONT_OFFICE_MANAGE)
  renewAssignmentLease(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('leaseId', new ParseUUIDPipe()) leaseId: string,
  ) {
    return this.leases.renew(tenant, id, leaseId);
  }

  @Delete('rooms/:id/assignment-leases/:leaseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.FRONT_OFFICE_MANAGE)
  releaseAssignmentLease(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('leaseId', new ParseUUIDPipe()) leaseId: string,
  ) {
    return this.leases.release(tenant, id, leaseId);
  }

  @Post('rooms/:id/lease-release')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.FRONT_OFFICE_MANAGE)
  releaseAssignmentLeaseForced(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReleaseRoomAssignmentLeaseDto,
  ) {
    return this.leases.releaseForced(tenant, id, dto.leaseId, dto.reason);
  }

  @Post('rooms/:id/assignment-leases/transfer')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.FRONT_OFFICE_MANAGE)
  transferAssignmentLease(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: TransferRoomAssignmentLeaseDto,
  ) {
    return this.leases.transfer(tenant, id, dto.toRoomId, dto.reason);
  }

  @Get('rooms/:id/blocks')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  listBlocks(@Tenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.blocks.list(tenant, id);
  }

  @Post('rooms/:id/blocks')
  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  createBlock(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateRoomBlockDto,
  ) {
    return this.blocks.create(tenant, id, dto);
  }

  @Post('rooms/:id/blocks/:blockId/release')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.INVENTORY_MANAGE)
  releaseBlock(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('blockId', new ParseUUIDPipe()) blockId: string,
    @Body() dto: ReleaseRoomBlockDto,
  ) {
    return this.blocks.release(tenant, id, blockId, dto);
  }

  @Get('rooms/:id/history')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  listHistory(
    @Tenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ListRoomHistoryQueryDto,
  ) {
    return this.rooms.listHistory(tenant, id, query);
  }
}