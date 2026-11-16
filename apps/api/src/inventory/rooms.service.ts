import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { HousekeepingState, Prisma, RecordStatus, RoomOperationalState } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { computeOperationalDay } from '../operational-day/operational-day';
import { PrismaService } from '../prisma/prisma.service';
import { formatCalendarDate } from '../reservations/reservation-dates';
import { CreateRoomDto, ListRoomsQueryDto, UpdateRoomDto } from './dto/room.dto';
import { HousekeepingTransitionDto } from './dto/housekeeping-transition.dto';
import { ListRoomHistoryQueryDto } from './dto/room-block.dto';
import { assertHousekeepingTransition } from './housekeeping-transitions';
import {
  RoomAssignmentLease,
  RoomAssignmentLeasesService,
} from './room-assignment-leases.service';
import { requirePropertyContext, RoomStateService } from './room-state.service';

export interface RoomResponse {
  id: string;
  organizationId: string;
  propertyId: string;
  roomTypeId: string;
  number: string;
  floor: string | null;
  building: string | null;
  attributes: string[];
  housekeepingState: HousekeepingState;
  operationalState: RoomOperationalState;
  status: RecordStatus;
  roomType: {
    id: string;
    name: string;
    code: string;
    capacityAdults: number;
    capacityChildren: number;
  };
  updatedBy: { id: string; name: string } | null;
  occupancy: 'VACANT' | 'OCCUPIED';
  currentStay: {
    id: string;
    reservationId: string;
    code: string;
    guestName: string;
    checkInDate: string;
    checkOutDate: string;
  } | null;
  nextArrival: {
    reservationId: string;
    code: string;
    guestName: string;
    checkInDate: string;
  } | null;
  activeBlock: { id: string; type: string; endsAt: Date } | null;
  lease: RoomAssignmentLease | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomListSummary {
  totalRooms: number;
  vacant: number;
  occupied: number;
  dirty: number;
  cleaning: number;
  clean: number;
  inspected: number;
  outOfOrder: number;
  outOfService: number;
}

export interface RoomListFacets {
  floors: string[];
  buildings: string[];
}

export interface RoomListResponse {
  items: RoomResponse[];
  nextCursor: string | null;
  summary: RoomListSummary;
  facets: RoomListFacets;
}

export interface RoomHistoryEntry {
  id: string;
  category: string;
  fromState: string | null;
  toState: string;
  reason: string | null;
  actorUserId: string | null;
  actorName: string | null;
  roomBlockId: string | null;
  correlationId: string | null;
  occurredAt: Date;
}

const ROOM_SELECT = Prisma.validator<Prisma.RoomSelect>()({
  id: true,
  organizationId: true,
  propertyId: true,
  roomTypeId: true,
  number: true,
  floor: true,
  building: true,
  attributes: true,
  housekeepingState: true,
  operationalState: true,
  status: true,
  roomType: {
    select: {
      id: true,
      name: true,
      code: true,
      capacityAdults: true,
      capacityChildren: true,
    },
  },
  updatedBy: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
});

const ROOM_LIST_SELECT = Prisma.validator<Prisma.RoomSelect>()({
  ...ROOM_SELECT,
  stays: {
    where: { status: 'IN_HOUSE' },
    take: 1,
    select: {
      id: true,
      reservationId: true,
      guest: { select: { fullName: true } },
      reservation: {
        select: { code: true, checkInDate: true, checkOutDate: true },
      },
    },
  },
});

type RoomListRow = Prisma.RoomGetPayload<{ select: typeof ROOM_LIST_SELECT }>;

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly roomState: RoomStateService,
    private readonly leases: RoomAssignmentLeasesService,
  ) {}

  async list(context: TenantContext, query: ListRoomsQueryDto): Promise<RoomListResponse> {
    const propertyId = requirePropertyContext(context);
    const today = await this.localToday(context.organizationId, propertyId);
    await this.roomState.reconcileProperty({
      organizationId: context.organizationId,
      propertyId,
      correlationId: context.correlationId,
    });

    const summary = await this.buildSummary(context.organizationId, propertyId);
    const facets = await this.buildFacets(context.organizationId, propertyId);

    const take = Math.min(query.limit ?? 50, 100);
    const where: Prisma.RoomWhereInput = {
      organizationId: context.organizationId,
      propertyId,
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.housekeepingState !== undefined
        ? { housekeepingState: query.housekeepingState }
        : {}),
      ...(query.operationalState !== undefined ? { operationalState: query.operationalState } : {}),
      ...(query.floor !== undefined ? { floor: query.floor } : {}),
      ...(query.building !== undefined ? { building: query.building } : {}),
    };

    if (query.roomTypeId !== undefined) {
      where.roomTypeId = query.roomTypeId;
    }

    if (query.minCapacity !== undefined) {
      const types = await this.prisma.roomType.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          status: RecordStatus.ACTIVE,
        },
        select: { id: true, capacityAdults: true, capacityChildren: true },
      });
      const capacityTypeIds = types
        .filter((type) => type.capacityAdults + type.capacityChildren >= query.minCapacity!)
        .map((type) => type.id);
      if (query.roomTypeId !== undefined && !capacityTypeIds.includes(query.roomTypeId)) {
        where.id = { in: [] };
      } else {
        where.roomTypeId = { in: capacityTypeIds };
      }
    }

    if (query.occupancy === 'OCCUPIED') {
      where.stays = { some: { status: 'IN_HOUSE' } };
    } else if (query.occupancy === 'VACANT') {
      where.stays = { none: { status: 'IN_HOUSE' } };
    }

    if (query.search !== undefined && query.search.trim().length > 0) {
      const search = query.search.trim();
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { floor: { contains: search, mode: 'insensitive' } },
        { building: { contains: search, mode: 'insensitive' } },
      ];
    }

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
      this.currentBlocks(context.organizationId, propertyId, roomIds),
      this.nextArrivals(context.organizationId, propertyId, roomIds, today),
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
        this.mapRoom(
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
    const today = await this.localToday(context.organizationId, propertyId);
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
      this.currentBlocks(context.organizationId, propertyId, [roomId]),
      this.nextArrivals(context.organizationId, propertyId, [roomId], today),
    ]);
    return this.mapRoom(
      room,
      leases.get(roomId) ?? null,
      blocks[0] ?? null,
      upcoming[0] ?? null,
    );
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

        return this.withEmptyRelations(created);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'room_number_conflict',
          message: 'A room with this number already exists in the property.',
        });
      }
      throw error;
    }
  }

  async update(context: TenantContext, roomId: string, dto: UpdateRoomDto): Promise<RoomResponse> {
    const propertyId = requirePropertyContext(context);

    if (dto.roomTypeId !== undefined) {
      await this.assertRoomType(context.organizationId, propertyId, dto.roomTypeId);
    }

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

    if (Object.keys(data).length === 0) {
      return this.get(context, roomId);
    }

    data.updatedByUserId = context.actor.id;

    try {
      return await this.prisma.$transaction(async (transaction) => {
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
              before: {
                number: before.number,
                roomTypeId: before.roomTypeId,
                floor: before.floor,
                building: before.building,
                attributes: before.attributes,
                status: before.status,
              },
              after: {
                number: updated.number,
                roomTypeId: updated.roomTypeId,
                floor: updated.floor,
                building: updated.building,
                attributes: updated.attributes,
                status: updated.status,
              },
            },
          },
          transaction,
        );

        return this.withEmptyRelations(updated);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'room_number_conflict',
          message: 'A room with this number already exists in the property.',
        });
      }
      throw error;
    }
  }

  async transitionHousekeeping(
    context: TenantContext,
    roomId: string,
    dto: HousekeepingTransitionDto,
  ): Promise<RoomResponse> {
    const propertyId = requirePropertyContext(context);

    return this.prisma.$transaction(async (transaction) => {
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

      return this.withEmptyRelations(updated);
    });
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

  private mapRoom(
    room: RoomListRow,
    lease: RoomAssignmentLease | null,
    block: { id: string; type: string; endsAt: Date } | null,
    next: { id: string; code: string; checkInDate: Date; guest: { fullName: string } } | null,
  ): RoomResponse {
    const stay = room.stays[0];

    return {
      id: room.id,
      organizationId: room.organizationId,
      propertyId: room.propertyId,
      roomTypeId: room.roomTypeId,
      number: room.number,
      floor: room.floor,
      building: room.building,
      attributes: room.attributes,
      housekeepingState: room.housekeepingState,
      operationalState: room.operationalState,
      status: room.status,
      roomType: room.roomType,
      updatedBy: room.updatedBy,
      occupancy: stay === undefined ? 'VACANT' : 'OCCUPIED',
      currentStay:
        stay === undefined
          ? null
          : {
              id: stay.id,
              reservationId: stay.reservationId,
              code: stay.reservation.code,
              guestName: stay.guest.fullName,
              checkInDate: formatCalendarDate(stay.reservation.checkInDate),
              checkOutDate: formatCalendarDate(stay.reservation.checkOutDate),
            },
      nextArrival:
        next === null
          ? null
          : {
              reservationId: next.id,
              code: next.code,
              guestName: next.guest.fullName,
              checkInDate: formatCalendarDate(next.checkInDate),
            },
      activeBlock:
        block === null ? null : { id: block.id, type: block.type, endsAt: block.endsAt },
      lease,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }

  private withEmptyRelations(room: Prisma.RoomGetPayload<{ select: typeof ROOM_SELECT }>): RoomResponse {
    return {
      ...room,
      occupancy: 'VACANT',
      currentStay: null,
      nextArrival: null,
      activeBlock: null,
      lease: null,
    };
  }

  private async buildSummary(
    organizationId: string,
    propertyId: string,
  ): Promise<RoomListSummary> {
    const rooms = await this.prisma.room.findMany({
      where: { organizationId, propertyId, status: RecordStatus.ACTIVE },
      select: { id: true, housekeepingState: true, operationalState: true },
    });
    const roomIds = rooms.map((room) => room.id);
    const stays =
      roomIds.length === 0
        ? []
        : await this.prisma.stay.findMany({
            where: {
              organizationId,
              propertyId,
              status: 'IN_HOUSE',
              roomId: { in: roomIds },
            },
            select: { roomId: true },
            distinct: ['roomId'],
          });
    const occupiedIds = new Set(stays.map((stay) => stay.roomId));

    return {
      totalRooms: rooms.length,
      vacant: rooms.filter((room) => !occupiedIds.has(room.id)).length,
      occupied: rooms.filter((room) => occupiedIds.has(room.id)).length,
      dirty: rooms.filter((room) => room.housekeepingState === 'DIRTY').length,
      cleaning: rooms.filter((room) => room.housekeepingState === 'CLEANING').length,
      clean: rooms.filter((room) => room.housekeepingState === 'CLEAN').length,
      inspected: rooms.filter((room) => room.housekeepingState === 'INSPECTED').length,
      outOfOrder: rooms.filter((room) => room.operationalState === 'OUT_OF_ORDER').length,
      outOfService: rooms.filter((room) => room.operationalState === 'OUT_OF_SERVICE').length,
    };
  }

  private async currentBlocks(
    organizationId: string,
    propertyId: string,
    roomIds: string[],
  ): Promise<Array<{ id: string; roomId: string; type: string; endsAt: Date }>> {
    if (roomIds.length === 0) {
      return [];
    }
    const now = new Date();
    return this.prisma.roomBlock.findMany({
      where: {
        organizationId,
        propertyId,
        roomId: { in: roomIds },
        status: 'ACTIVE',
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      orderBy: [{ endsAt: 'asc' }, { id: 'asc' }],
      select: { id: true, roomId: true, type: true, endsAt: true },
    });
  }

  private async nextArrivals(
    organizationId: string,
    propertyId: string,
    roomIds: string[],
    today: string,
  ): Promise<
    Array<{
      id: string;
      roomId: string | null;
      code: string;
      checkInDate: Date;
      guest: { fullName: string };
    }>
  > {
    if (roomIds.length === 0) {
      return [];
    }
    return this.prisma.reservation.findMany({
      where: {
        organizationId,
        propertyId,
        roomId: { in: roomIds },
        status: 'CONFIRMED',
        checkInDate: { gte: new Date(`${today}T00:00:00.000Z`) },
      },
      orderBy: [{ checkInDate: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        roomId: true,
        code: true,
        checkInDate: true,
        guest: { select: { fullName: true } },
      },
    });
  }

  private async buildFacets(
    organizationId: string,
    propertyId: string,
  ): Promise<RoomListFacets> {
    const rooms = await this.prisma.room.findMany({
      where: { organizationId, propertyId, status: RecordStatus.ACTIVE },
      select: { floor: true, building: true },
    });
    return {
      floors: [...new Set(rooms.map((room) => room.floor).filter((value) => value !== null))].sort(),
      buildings: [
        ...new Set(rooms.map((room) => room.building).filter((value) => value !== null)),
      ].sort(),
    };
  }

  private async localToday(organizationId: string, propertyId: string): Promise<string> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId },
      select: { timezone: true, operationalDayStart: true },
    });
    if (property === null) {
      throw new NotFoundException({
        code: 'property_not_found',
        message: 'Property not found in the selected organization.',
      });
    }
    return computeOperationalDay(
      new Date(),
      property.timezone,
      property.operationalDayStart,
    ).localDate;
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
