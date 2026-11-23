import { StayStatus } from '@prisma/client';
import { addCalendarDays, propertyDayBounds, propertyDayStart } from '../common/time/property-day';
import type { PrismaService } from '../prisma/prisma.service';
import type { ReportProperty } from './report-definitions';
import {
  MAX_ROWS,
  type BuiltReport,
  assertWithinLimit,
  calendarDayCount,
  round2,
} from './reports.support';

interface OccupancyDayTotals {
  occupied: number;
  outOfService: number;
  sellable: number;
  available: number;
}

interface OccupancyDays {
  rows: Array<Record<string, string | number | null>>;
  totalRooms: number;
  occupied: number;
  outOfService: number;
  sellable: number;
  available: number;
}

interface OccupancyBlock {
  roomId: string;
  type: string;
  startsAt: Date;
  endsAt: Date;
  releasedAt: Date | null;
}

interface OccupancyData {
  activeRoomIds: Set<string>;
  stays: Array<{ roomId: string; checkedInAt: Date; checkedOutAt: Date | null }>;
  blocks: OccupancyBlock[];
}

export async function buildOccupancyReport(
  prisma: PrismaService,
  base: Omit<BuiltReport, 'summary' | 'rows'>,
  property: ReportProperty,
  filters: { from: string; to: string },
): Promise<BuiltReport> {
  const data = await fetchOccupancyData(prisma, base.organizationId, property, filters);
  const days = buildOccupancyDays(data, property, filters);

  return {
    ...base,
    summary: [
      {
        key: 'activeRooms',
        label: 'Habitaciones activas',
        value: days.totalRooms,
        format: 'number',
      },
      {
        key: 'occupiedRoomNights',
        label: 'Noches-cuarto ocupadas',
        value: days.occupied,
        format: 'number',
      },
      {
        key: 'sellableRoomNights',
        label: 'Noches-cuarto vendibles',
        value: days.sellable,
        format: 'number',
      },
      {
        key: 'availableRoomNights',
        label: 'Noches-cuarto disponibles',
        value: days.available,
        format: 'number',
      },
      {
        key: 'outOfServiceRoomNights',
        label: 'Noches-cuarto fuera de servicio',
        value: days.outOfService,
        format: 'number',
      },
      {
        key: 'averageOccupancy',
        label: 'Ocupación promedio',
        value: days.sellable > 0 ? round2((days.occupied / days.sellable) * 100) : 0,
        format: 'percent',
      },
    ],
    rows: days.rows,
  };
}

async function fetchOccupancyData(
  prisma: PrismaService,
  organizationId: string,
  property: ReportProperty,
  filters: { from: string; to: string },
): Promise<OccupancyData> {
  const { gte, lt } = propertyDayBounds(filters.from, filters.to, property.timezone);
  const rangeStart = gte ?? propertyDayStart(filters.from, property.timezone);
  const rangeEnd = lt ?? propertyDayStart(addCalendarDays(filters.to, 1), property.timezone);

  const [rooms, stays, blocks] = await Promise.all([
    prisma.room.findMany({
      where: { organizationId, propertyId: property.id, status: 'ACTIVE' },
      take: MAX_ROWS + 1,
      select: { id: true },
    }),
    prisma.stay.findMany({
      where: {
        organizationId,
        propertyId: property.id,
        status: { in: [StayStatus.IN_HOUSE, StayStatus.CHECKED_OUT] },
        checkedInAt: { lt: rangeEnd },
        OR: [{ checkedOutAt: null }, { checkedOutAt: { gte: rangeStart } }],
      },
      take: MAX_ROWS + 1,
      select: { roomId: true, checkedInAt: true, checkedOutAt: true },
    }),
    prisma.roomBlock.findMany({
      where: {
        organizationId,
        propertyId: property.id,
        startsAt: { lt: rangeEnd },
        endsAt: { gt: rangeStart },
      },
      take: MAX_ROWS + 1,
      select: {
        roomId: true,
        type: true,
        startsAt: true,
        endsAt: true,
        releasedAt: true,
      },
    }),
  ]);
  assertWithinLimit(rooms.length);
  assertWithinLimit(stays.length);
  assertWithinLimit(blocks.length);

  return {
    activeRoomIds: new Set(rooms.map((room) => room.id)),
    stays,
    blocks,
  };
}

function buildOccupancyDays(
  data: OccupancyData,
  property: ReportProperty,
  filters: { from: string; to: string },
): OccupancyDays {
  const rows: Array<Record<string, string | number | null>> = [];
  const totals: OccupancyDayTotals = { occupied: 0, outOfService: 0, sellable: 0, available: 0 };

  for (let offset = 0; offset < calendarDayCount(filters.from, filters.to); offset += 1) {
    const date = addCalendarDays(filters.from, offset);
    const dayStartMs = propertyDayStart(date, property.timezone).getTime();
    const dayEndMs = propertyDayStart(addCalendarDays(date, 1), property.timezone).getTime();

    const outOfServiceRoomIds = new Set(
      data.blocks
        .filter((block) => block.type === 'OUT_OF_ORDER' || block.type === 'OUT_OF_SERVICE')
        .filter((block) => {
          const effectiveEnd = block.releasedAt ?? block.endsAt;
          return (
            block.startsAt.getTime() < dayEndMs &&
            effectiveEnd.getTime() > dayStartMs &&
            data.activeRoomIds.has(block.roomId)
          );
        })
        .map((block) => block.roomId),
    );
    const occupiedRoomIds = new Set(
      data.stays
        .filter((stay) => data.activeRoomIds.has(stay.roomId))
        .filter(
          (stay) =>
            stay.checkedInAt.getTime() < dayEndMs &&
            (stay.checkedOutAt === null || stay.checkedOutAt.getTime() >= dayEndMs),
        )
        .map((stay) => stay.roomId),
    );

    const totalRooms = data.activeRoomIds.size;
    const outOfService = outOfServiceRoomIds.size;
    const sellable = Math.max(0, totalRooms - outOfService);
    const occupied = occupiedRoomIds.size;
    const available = Math.max(0, sellable - occupied);

    totals.occupied += occupied;
    totals.outOfService += outOfService;
    totals.sellable += sellable;
    totals.available += available;
    rows.push({
      date,
      totalRooms,
      outOfService,
      sellable,
      occupied,
      available,
      occupancyRate: sellable > 0 ? round2((occupied / sellable) * 100) : 0,
    });
  }

  return { rows, totalRooms: data.activeRoomIds.size, ...totals };
}
