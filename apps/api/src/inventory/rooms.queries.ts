import { NotFoundException } from '@nestjs/common';
import { Prisma, RecordStatus } from '@prisma/client';
import { computeOperationalDay } from '../operational-day/operational-day';
import type { PrismaService } from '../prisma/prisma.service';
import type { ListRoomsQueryDto } from './dto/room.dto';
import type { RoomListFacets, RoomListSummary } from './rooms.contracts';

export async function buildRoomListWhere(
  prisma: PrismaService,
  organizationId: string,
  propertyId: string,
  query: ListRoomsQueryDto,
): Promise<Prisma.RoomWhereInput> {
  const where: Prisma.RoomWhereInput = {
    organizationId,
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

  await applyCapacityFilter(prisma, where, organizationId, propertyId, query);
  applyOccupancyFilter(where, query.occupancy);
  applySearchFilter(where, query.search);

  return where;
}

/** Rooms whose type can host `minCapacity` guests, honouring an explicit type. */
async function applyCapacityFilter(
  prisma: PrismaService,
  where: Prisma.RoomWhereInput,
  organizationId: string,
  propertyId: string,
  query: ListRoomsQueryDto,
): Promise<void> {
  if (query.minCapacity === undefined) {
    return;
  }

  const minCapacity = query.minCapacity;
  const types = await prisma.roomType.findMany({
    where: {
      organizationId,
      propertyId,
      status: RecordStatus.ACTIVE,
    },
    select: { id: true, capacityAdults: true, capacityChildren: true },
  });
  const capacityTypeIds = types
    .filter((type) => type.capacityAdults + type.capacityChildren >= minCapacity)
    .map((type) => type.id);

  if (query.roomTypeId !== undefined && !capacityTypeIds.includes(query.roomTypeId)) {
    where.id = { in: [] };
    return;
  }
  where.roomTypeId = { in: capacityTypeIds };
}

function applyOccupancyFilter(
  where: Prisma.RoomWhereInput,
  occupancy: ListRoomsQueryDto['occupancy'],
): void {
  if (occupancy === 'OCCUPIED') {
    where.stays = { some: { status: 'IN_HOUSE' } };
  } else if (occupancy === 'VACANT') {
    where.stays = { none: { status: 'IN_HOUSE' } };
  }
}

function applySearchFilter(where: Prisma.RoomWhereInput, value: string | undefined): void {
  const search = value?.trim() ?? '';
  if (search.length === 0) {
    return;
  }
  where.OR = [
    { number: { contains: search, mode: 'insensitive' } },
    { floor: { contains: search, mode: 'insensitive' } },
    { building: { contains: search, mode: 'insensitive' } },
  ];
}

export async function buildRoomSummary(
  prisma: PrismaService,
  organizationId: string,
  propertyId: string,
): Promise<RoomListSummary> {
  const rooms = await prisma.room.findMany({
    where: { organizationId, propertyId, status: RecordStatus.ACTIVE },
    select: { id: true, housekeepingState: true, operationalState: true },
  });
  const roomIds = rooms.map((room) => room.id);
  const stays =
    roomIds.length === 0
      ? []
      : await prisma.stay.findMany({
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
  const countBy = (predicate: (room: (typeof rooms)[number]) => boolean): number =>
    rooms.filter(predicate).length;

  return {
    totalRooms: rooms.length,
    vacant: countBy((room) => !occupiedIds.has(room.id)),
    occupied: countBy((room) => occupiedIds.has(room.id)),
    dirty: countBy((room) => room.housekeepingState === 'DIRTY'),
    cleaning: countBy((room) => room.housekeepingState === 'CLEANING'),
    clean: countBy((room) => room.housekeepingState === 'CLEAN'),
    inspected: countBy((room) => room.housekeepingState === 'INSPECTED'),
    outOfOrder: countBy((room) => room.operationalState === 'OUT_OF_ORDER'),
    outOfService: countBy((room) => room.operationalState === 'OUT_OF_SERVICE'),
  };
}

export async function buildRoomFacets(
  prisma: PrismaService,
  organizationId: string,
  propertyId: string,
): Promise<RoomListFacets> {
  const rooms = await prisma.room.findMany({
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

export async function currentRoomBlocks(
  prisma: PrismaService,
  organizationId: string,
  propertyId: string,
  roomIds: string[],
  now: Date,
): Promise<Array<{ id: string; roomId: string; type: string; endsAt: Date }>> {
  if (roomIds.length === 0) {
    return [];
  }
  return prisma.roomBlock.findMany({
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

export async function nextRoomArrivals(
  prisma: PrismaService,
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
  return prisma.reservation.findMany({
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

export async function localOperationalDate(
  prisma: PrismaService,
  organizationId: string,
  propertyId: string,
  now: Date,
): Promise<string> {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId },
    select: { timezone: true, operationalDayStart: true },
  });
  if (property === null) {
    throw new NotFoundException({
      code: 'property_not_found',
      message: 'Property not found in the selected organization.',
    });
  }
  return computeOperationalDay(now, property.timezone, property.operationalDayStart).localDate;
}
