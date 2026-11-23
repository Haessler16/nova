import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { HousekeepingState, Prisma, RecordStatus, RoomOperationalState } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { Clock } from '../common/time/clock';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto, ListRoomsQueryDto, UpdateRoomDto } from './dto/room.dto';
import { HousekeepingTransitionDto } from './dto/housekeeping-transition.dto';
import { ListRoomHistoryQueryDto } from './dto/room-block.dto';
import { assertHousekeepingTransition } from './housekeeping-transitions';
import { RoomEventsService } from './room-events.service';
import { RoomAssignmentLeasesService } from './room-assignment-leases.service';
import { requirePropertyContext, RoomStateService } from './room-state.service';
import {
  ROOM_LIST_SELECT,
  ROOM_SELECT,
  type RoomHistoryEntry,
  type RoomListResponse,
  type RoomResponse,
} from './rooms.contracts';
import { mapRoom, withEmptyRelations } from './rooms.mapper';
import {
  buildRoomFacets,
  buildRoomListWhere,
  buildRoomSummary,
  currentRoomBlocks,
  localOperationalDate,
  nextRoomArrivals,
} from './rooms.queries';

export type {
  RoomHistoryEntry,
  RoomListFacets,
  RoomListResponse,
  RoomListSummary,
  RoomResponse,
} from './rooms.contracts';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly roomState: RoomStateService,
    private readonly leases: RoomAssignmentLeasesService,
    private readonly events: RoomEventsService,
    private readonly clock: Clock,
  ) {}

  async list(context: TenantContext, query: ListRoomsQueryDto): Promise<RoomListResponse> {
    const propertyId = requirePropertyContext(context);
    const today = await localOperationalDate(
      this.prisma,
      context.organizationId,
      propertyId,
      this.clock.now(),
    );
    await this.roomState.reconcileProperty({
      organizationId: context.organizationId,
      propertyId,
      correlationId: context.correlationId,
    });

    const summary = await buildRoomSummary(this.prisma, context.organizationId, propertyId);
    const facets = await buildRoomFacets(this.prisma, context.organizationId, propertyId);

    const take = Math.min(query.limit ?? 50, 100);
    const where = await buildRoomListWhere(
      this.prisma,
      context.organizationId,
      propertyId,
      query,
    );

    const rows = await this.prisma.room.findMany({
      where,
      take: take + 1,
      ...(query.cursor !== undefined ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ number: 'asc' }, { id: 'asc' }],
      select: ROOM_LIST_SELECT,
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const roomIds = items.map((room) => room.id);
    const [leases, blocks, upcoming] = await Promise.all([
      this.leases.getMany(context, roomIds),
      currentRoomBlocks(
        this.prisma,
        context.organizationId,
        propertyId,
        roomIds,
        this.clock.now(),
      ),
      nextRoomArrivals(this.prisma, context.organizationId, propertyId, roomIds, today),
    ]);
    const blockByRoom = new Map(blocks.map((block) => [block.roomId, block]));
    const nextByRoom = new Map<string, (typeof upcoming)[number]>();
    for (const reservation of upcoming) {
      if (reservation.roomId !== null && !nextByRoom.has(reservation.roomId)) {
        nextByRoom.set(reservation.roomId, reservation);
      }
    }

    return {
      items: items.map((room) =>
        mapRoom(
          room,
          leases.get(room.id) ?? null,
          blockByRoom.get(room.id) ?? null,
          nextByRoom.get(room.id) ?? null,
        ),
      ),
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
      summary,
      facets,
    };
  }

  async get(context: TenantContext, roomId: string): Promise<RoomResponse> {
    const propertyId = requirePropertyContext(context);
    const today = await localOperationalDate(
      this.prisma,
      context.organizationId,
      propertyId,
      this.clock.now(),
    );
    await this.roomState.reconcileProperty({
      organizationId: context.organizationId,
      propertyId,
      correlationId: context.correlationId,
    });

    const room = await this.prisma.room.findFirst({
      where: {
        id: roomId,
        organizationId: context.organizationId,
        propertyId,
      },
      select: ROOM_LIST_SELECT,
    });

    if (room === null) {
      throw new NotFoundException({
        code: 'room_not_found',
        message: 'Room not found in the selected property.',
      });
    }

    const [leases, blocks, upcoming] = await Promise.all([
      this.leases.getMany(context, [roomId]),
      currentRoomBlocks(
        this.prisma,
        context.organizationId,
        propertyId,
        [roomId],
        this.clock.now(),
      ),
      nextRoomArrivals(this.prisma, context.organizationId, propertyId, [roomId], today),
    ]);
    return mapRoom(room, leases.get(roomId) ?? null, blocks[0] ?? null, upcoming[0] ?? null);
  }

  async create(context: TenantContext, dto: CreateRoomDto): Promise<RoomResponse> {
    const propertyId = requirePropertyContext(context);
    await this.assertRoomType(context.organizationId, propertyId, dto.roomTypeId);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.room.create({
          data: {
            organizationId: context.organizationId,
            propertyId,
            roomTypeId: dto.roomTypeId,
            number: dto.number.trim(),
            floor: dto.floor?.trim(),
            building: dto.building?.trim(),
            attributes: dto.attributes?.map((attribute) => attribute.trim()) ?? [],
            updatedByUserId: context.actor.id,
          },
          select: ROOM_SELECT,
        });

        await transaction.roomStatusHistory.createMany({
          data: [
            {
              organizationId: context.organizationId,
              propertyId,
              roomId: created.id,
              category: 'HOUSEKEEPING',
              toState: HousekeepingState.DIRTY,
              reason: 'Room created.',
              actorUserId: context.actor.id,
              correlationId: context.correlationId,
            },
            {
              organizationId: context.organizationId,
              propertyId,
              roomId: created.id,
              category: 'OPERATIONAL',
              toState: RoomOperationalState.AVAILABLE,
              reason: 'Room created.',
              actorUserId: context.actor.id,
              correlationId: context.correlationId,
            },
          ],
        });

        await this.audit.append(
          {
            organizationId: context.organizationId,
            propertyId,
            actorUserId: context.actor.id,
            action: 'room.created',
            entityType: 'Room',
            entityId: created.id,
            correlationId: context.correlationId,
            metadata: {
              number: created.number,
              roomTypeId: created.roomTypeId,
              housekeepingState: created.housekeepingState,
            },
          },
          transaction,
        );

        return withEmptyRelations(created);
      });
    } catch (error) {
      throw roomWriteError(error);
    }
  }

  async update(context: TenantContext, roomId: string, dto: UpdateRoomDto): Promise<RoomResponse> {
    const propertyId = requirePropertyContext(context);

    if (dto.roomTypeId !== undefined) {
      await this.assertRoomType(context.organizationId, propertyId, dto.roomTypeId);
    }

    const data = buildRoomUpdateData(dto);
    if (Object.keys(data).length === 0) {
      return this.get(context, roomId);
    }

    data.updatedByUserId = context.actor.id;

    try {
      const result = await this.prisma.$transaction(async (transaction) => {
        await this.roomState.lockRoom(transaction, context.organizationId, propertyId, roomId);

        const before = await transaction.room.findFirst({
          where: { id: roomId, organizationId: context.organizationId, propertyId },
          select: ROOM_SELECT,
        });

        if (before === null) {
          throw new NotFoundException({
            code: 'room_not_found',
            message: 'Room not found in the selected property.',
          });
        }

        const updated = await transaction.room.update({
          where: { id: roomId },
          data,
          select: ROOM_SELECT,
        });

        await this.audit.append(
          {
            organizationId: context.organizationId,
            propertyId,
            actorUserId: context.actor.id,
            action: 'room.updated',
            entityType: 'Room',
            entityId: roomId,
            correlationId: context.correlationId,
            metadata: {
              before: roomAuditSnapshot(before),
              after: roomAuditSnapshot(updated),
            },
          },
          transaction,
        );

        return withEmptyRelations(updated);
      });

      this.events.publish(context.organizationId, propertyId, {
        roomId,
        type: 'room.updated',
      });
      return result;
    } catch (error) {
      throw roomWriteError(error);
    }
  }

  async transitionHousekeeping(
    context: TenantContext,
    roomId: string,
    dto: HousekeepingTransitionDto,
  ): Promise<RoomResponse> {
    const propertyId = requirePropertyContext(context);

    const result = await this.prisma.$transaction(async (transaction) => {
      await this.roomState.lockRoom(transaction, context.organizationId, propertyId, roomId);

      const before = await transaction.room.findFirst({
        where: { id: roomId, organizationId: context.organizationId, propertyId },
        select: ROOM_SELECT,
      });

      if (before === null) {
        throw new NotFoundException({
          code: 'room_not_found',
          message: 'Room not found in the selected property.',
        });
      }

      assertHousekeepingTransition(before.housekeepingState, dto.state);

      const updated = await transaction.room.update({
        where: { id: roomId },
        data: {
          housekeepingState: dto.state,
          updatedByUserId: context.actor.id,
        },
        select: ROOM_SELECT,
      });

      await transaction.roomStatusHistory.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          roomId,
          category: 'HOUSEKEEPING',
          fromState: before.housekeepingState,
          toState: dto.state,
          reason: dto.reason?.trim() ?? 'Housekeeping state transition.',
          actorUserId: context.actor.id,
          correlationId: context.correlationId,
        },
        select: { id: true },
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'room.housekeeping_state_changed',
          entityType: 'Room',
          entityId: roomId,
          correlationId: context.correlationId,
          reason: dto.reason?.trim(),
          metadata: {
            roomNumber: before.number,
            from: before.housekeepingState,
            to: dto.state,
          },
        },
        transaction,
      );

      return withEmptyRelations(updated);
    });

    this.events.publish(context.organizationId, propertyId, {
      roomId,
      type: 'room.housekeeping',
    });
    return result;
  }

  async listHistory(
    context: TenantContext,
    roomId: string,
    query: ListRoomHistoryQueryDto,
  ): Promise<{ items: RoomHistoryEntry[]; nextCursor: string | null }> {
    const propertyId = requirePropertyContext(context);

    const room = await this.prisma.room.findFirst({
      where: { id: roomId, organizationId: context.organizationId, propertyId },
      select: { id: true },
    });

    if (room === null) {
      throw new NotFoundException({
        code: 'room_not_found',
        message: 'Room not found in the selected property.',
      });
    }

    const take = Math.min(query.limit ?? 50, 100);
    const rows = await this.prisma.roomStatusHistory.findMany({
      where: { organizationId: context.organizationId, propertyId, roomId },
      take: take + 1,
      ...(query.cursor !== undefined ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        category: true,
        fromState: true,
        toState: true,
        reason: true,
        actorUserId: true,
        actor: { select: { name: true } },
        roomBlockId: true,
        correlationId: true,
        occurredAt: true,
      },
    });

    const hasMore = rows.length > take;
    const items = (hasMore ? rows.slice(0, take) : rows).map((row) => ({
      id: row.id,
      category: row.category,
      fromState: row.fromState,
      toState: row.toState,
      reason: row.reason,
      actorUserId: row.actorUserId,
      actorName: row.actor?.name ?? null,
      roomBlockId: row.roomBlockId,
      correlationId: row.correlationId,
      occurredAt: row.occurredAt,
    }));

    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }

  private async assertRoomType(
    organizationId: string,
    propertyId: string,
    roomTypeId: string,
  ): Promise<void> {
    const roomType = await this.prisma.roomType.findFirst({
      where: {
        id: roomTypeId,
        organizationId,
        propertyId,
        status: RecordStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (roomType === null) {
      throw new NotFoundException({
        code: 'room_type_not_found',
        message: 'Room type not found in the selected property.',
      });
    }
  }
}

function buildRoomUpdateData(dto: UpdateRoomDto): Prisma.RoomUncheckedUpdateInput {
  const data: Prisma.RoomUncheckedUpdateInput = {};
  if (dto.number !== undefined) {
    data.number = dto.number.trim();
  }
  if (dto.roomTypeId !== undefined) {
    data.roomTypeId = dto.roomTypeId;
  }
  if (dto.floor !== undefined) {
    data.floor = dto.floor.trim();
  }
  if (dto.building !== undefined) {
    data.building = dto.building.trim();
  }
  if (dto.attributes !== undefined) {
    data.attributes = dto.attributes.map((attribute) => attribute.trim());
  }
  if (dto.status !== undefined) {
    data.status = dto.status;
  }
  return data;
}

function roomAuditSnapshot(room: {
  number: string;
  roomTypeId: string;
  floor: string | null;
  building: string | null;
  attributes: string[];
  status: RecordStatus;
}): Record<string, unknown> {
  return {
    number: room.number,
    roomTypeId: room.roomTypeId,
    floor: room.floor,
    building: room.building,
    attributes: room.attributes,
    status: room.status,
  };
}

function roomWriteError(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return new ConflictException({
      code: 'room_number_conflict',
      message: 'A room with this number already exists in the property.',
    });
  }
  return error;
}
