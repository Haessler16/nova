import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RecordStatus, HousekeepingState, RoomOperationalState } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto, ListRoomsQueryDto, UpdateRoomDto } from './dto/room.dto';
import { HousekeepingTransitionDto } from './dto/housekeeping-transition.dto';
import { ListRoomHistoryQueryDto } from './dto/room-block.dto';
import { assertHousekeepingTransition } from './housekeeping-transitions';
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
  roomType: { id: string; name: string; code: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomHistoryEntry {
  id: string;
  category: string;
  fromState: string | null;
  toState: string;
  reason: string | null;
  actorUserId: string | null;
  roomBlockId: string | null;
  correlationId: string | null;
  occurredAt: Date;
}

const ROOM_SELECT = {
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
  roomType: { select: { id: true, name: true, code: true } },
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly roomState: RoomStateService,
  ) {}

  async list(
    context: TenantContext,
    query: ListRoomsQueryDto,
  ): Promise<{ items: RoomResponse[]; nextCursor: string | null }> {
    const propertyId = requirePropertyContext(context);
    await this.roomState.reconcileProperty({
      organizationId: context.organizationId,
      propertyId,
      correlationId: context.correlationId,
    });

    const take = Math.min(query.limit ?? 50, 100);
    const where: Prisma.RoomWhereInput = {
      organizationId: context.organizationId,
      propertyId,
      ...(query.roomTypeId !== undefined ? { roomTypeId: query.roomTypeId } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.housekeepingState !== undefined
        ? { housekeepingState: query.housekeepingState }
        : {}),
      ...(query.operationalState !== undefined ? { operationalState: query.operationalState } : {}),
    };

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
      select: ROOM_SELECT,
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;

    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }

  async get(context: TenantContext, roomId: string): Promise<RoomResponse> {
    const propertyId = requirePropertyContext(context);
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
      select: ROOM_SELECT,
    });

    if (room === null) {
      throw new NotFoundException({
        code: 'room_not_found',
        message: 'Room not found in the selected property.',
      });
    }

    return room;
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

        return created;
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

        return updated;
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
        data: { housekeepingState: dto.state },
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

      return updated;
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
        roomBlockId: true,
        correlationId: true,
        occurredAt: true,
      },
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;

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
