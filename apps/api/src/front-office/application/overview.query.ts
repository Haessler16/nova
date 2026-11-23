import { Injectable } from '@nestjs/common';
import { Prisma, ReservationStatus, StayStatus } from '@prisma/client';
import { TenantContext } from '../../common/http/request-context';
import { Clock } from '../../common/time/clock';
import { addCalendarDays, propertyDayStart } from '../../common/time/property-day';
import { requirePropertyContext } from '../../inventory/room-state.service';
import { computeOperationalDay } from '../../operational-day/operational-day';
import { PrismaService } from '../../prisma/prisma.service';
import { formatCalendarDate, parseCalendarDate } from '../../reservations/reservation-dates';
import { FrontOfficeOverviewQueryDto } from '../dto/front-office.dto';
import { PropertyLoader } from '../infrastructure/property-loader';
import {
  mapReservationSummary,
  mapStay,
  RESERVATION_SUMMARY_SELECT,
  STAY_SELECT,
  type FrontOfficeOverview,
  type ReservationSummaryRow,
  type RoomRackItem,
  type StayRow,
} from './front-office.contracts';

const ROOM_RACK_ROOM_SELECT = {
  id: true,
  number: true,
  floor: true,
  building: true,
  housekeepingState: true,
  operationalState: true,
  roomType: { select: { id: true, name: true, code: true } },
} as const;

const ROOM_RACK_STAY_SELECT = {
  id: true,
  roomId: true,
  reservationId: true,
  guest: { select: { fullName: true } },
  reservation: { select: { code: true, checkOutDate: true } },
} as const;

const ROOM_RACK_BLOCK_SELECT = {
  id: true,
  roomId: true,
  type: true,
  endsAt: true,
} as const;

const ROOM_RACK_ARRIVAL_SELECT = {
  id: true,
  code: true,
  roomId: true,
  checkInDate: true,
  guest: { select: { fullName: true } },
} as const;

type RoomRackRoom = Prisma.RoomGetPayload<{ select: typeof ROOM_RACK_ROOM_SELECT }>;
type RoomRackStay = Prisma.StayGetPayload<{ select: typeof ROOM_RACK_STAY_SELECT }>;
type RoomRackBlock = Prisma.RoomBlockGetPayload<{ select: typeof ROOM_RACK_BLOCK_SELECT }>;
type RoomRackArrival = Prisma.ReservationGetPayload<{ select: typeof ROOM_RACK_ARRIVAL_SELECT }>;

interface DayBounds {
  start: Date;
  end: Date;
}

interface DayActivity {
  arrivals: ReservationSummaryRow[];
  departures: StayRow[];
  inHouse: StayRow[];
  noShowCandidates: ReservationSummaryRow[];
}

/**
 * Read model behind the front-desk overview. It only reads: the arrival,
 * departure and in-house lists plus a room rack snapshot for the selected day.
 */
@Injectable()
export class OverviewQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly properties: PropertyLoader,
  ) {}

  async overview(
    context: TenantContext,
    query: FrontOfficeOverviewQueryDto,
  ): Promise<FrontOfficeOverview> {
    const propertyId = requirePropertyContext(context);
    const property = await this.properties.load(context.organizationId, propertyId);
    const operationalDay = computeOperationalDay(
      this.clock.now(),
      property.timezone,
      property.operationalDayStart,
    );
    const date = query.date ?? operationalDay.operationalDate;
    const dateValue = parseCalendarDate(date, 'date');
    const operationalDateValue = parseCalendarDate(
      operationalDay.operationalDate,
      'operationalDate',
    );
    const now = this.clock.now();
    const isHistorical = date < operationalDay.operationalDate;
    const bounds: DayBounds | null = isHistorical
      ? {
          start: propertyDayStart(date, property.timezone),
          end: propertyDayStart(addCalendarDays(date, 1), property.timezone),
        }
      : null;

    const [activity, roomRack] = await Promise.all([
      this.loadActivity(context, propertyId, dateValue, bounds),
      this.loadRoomRack(context, propertyId, operationalDateValue, now),
    ]);

    return {
      operationalDate: operationalDay.operationalDate,
      selectedDate: date,
      isHistorical,
      localDate: operationalDay.localDate,
      localTime: operationalDay.localTime,
      timezone: operationalDay.timezone,
      operationalDayStart: operationalDay.operationalDayStart,
      counts: {
        arrivals: activity.arrivals.length,
        departures: activity.departures.length,
        inHouse: activity.inHouse.length,
        noShowCandidates: activity.noShowCandidates.length,
        vacantRooms: roomRack.filter((room) => room.occupancy === 'VACANT').length,
        occupiedRooms: roomRack.filter((room) => room.occupancy === 'OCCUPIED').length,
      },
      arrivals: activity.arrivals.map(mapReservationSummary),
      departures: activity.departures.map(mapStay),
      inHouse: activity.inHouse.map(mapStay),
      noShowCandidates: activity.noShowCandidates.map(mapReservationSummary),
      roomRack,
    };
  }

  private loadActivity(
    context: TenantContext,
    propertyId: string,
    dateValue: Date,
    bounds: DayBounds | null,
  ): Promise<DayActivity> {
    return bounds === null
      ? this.loadCurrentActivity(context, propertyId, dateValue)
      : this.loadHistoricalActivity(context, propertyId, dateValue, bounds);
  }

  /**
   * Historical days show what happened, not what still needs attention: arrivals
   * for that calendar day regardless of final status, stays active during that
   * day, and check-outs registered during that day. Instant-based bounds use the
   * property timezone, not UTC midnights.
   */
  private async loadHistoricalActivity(
    context: TenantContext,
    propertyId: string,
    dateValue: Date,
    bounds: DayBounds,
  ): Promise<DayActivity> {
    const [arrivals, departures, inHouse, noShowCandidates] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          status: { not: ReservationStatus.CANCELLED },
          checkInDate: dateValue,
        },
        orderBy: [{ checkInDate: 'asc' }, { code: 'asc' }],
        take: 200,
        select: RESERVATION_SUMMARY_SELECT,
      }),
      this.prisma.stay.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          checkedOutAt: { gte: bounds.start, lt: bounds.end },
        },
        orderBy: [{ checkedOutAt: 'asc' }, { id: 'asc' }],
        take: 200,
        select: STAY_SELECT,
      }),
      this.prisma.stay.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          checkedInAt: { lt: bounds.end },
          OR: [{ checkedOutAt: null }, { checkedOutAt: { gte: bounds.start } }],
        },
        orderBy: [{ checkedInAt: 'asc' }, { id: 'asc' }],
        take: 300,
        select: STAY_SELECT,
      }),
      this.prisma.reservation.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          status: ReservationStatus.NO_SHOW,
          checkInDate: dateValue,
        },
        orderBy: [{ code: 'asc' }],
        take: 100,
        select: RESERVATION_SUMMARY_SELECT,
      }),
    ]);

    return { arrivals, departures, inHouse, noShowCandidates };
  }

  private async loadCurrentActivity(
    context: TenantContext,
    propertyId: string,
    dateValue: Date,
  ): Promise<DayActivity> {
    const [arrivals, departures, inHouse, noShowCandidates] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          status: ReservationStatus.CONFIRMED,
          checkInDate: { lte: dateValue },
        },
        orderBy: [{ checkInDate: 'asc' }, { code: 'asc' }],
        take: 200,
        select: RESERVATION_SUMMARY_SELECT,
      }),
      this.prisma.stay.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          status: StayStatus.IN_HOUSE,
          reservation: { checkOutDate: { lte: dateValue } },
        },
        orderBy: [{ checkedInAt: 'asc' }, { id: 'asc' }],
        take: 200,
        select: STAY_SELECT,
      }),
      this.prisma.stay.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          status: StayStatus.IN_HOUSE,
        },
        orderBy: [{ checkedInAt: 'asc' }, { id: 'asc' }],
        take: 300,
        select: STAY_SELECT,
      }),
      this.prisma.reservation.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          status: ReservationStatus.CONFIRMED,
          checkInDate: { lt: dateValue },
        },
        orderBy: [{ checkInDate: 'asc' }, { code: 'asc' }],
        take: 100,
        select: RESERVATION_SUMMARY_SELECT,
      }),
    ]);

    return { arrivals, departures, inHouse, noShowCandidates };
  }

  private async loadRoomRack(
    context: TenantContext,
    propertyId: string,
    operationalDateValue: Date,
    now: Date,
  ): Promise<RoomRackItem[]> {
    const [rooms, activeStays, blocks, upcoming] = await Promise.all([
      this.prisma.room.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          status: 'ACTIVE',
        },
        orderBy: [{ number: 'asc' }, { id: 'asc' }],
        take: 300,
        select: ROOM_RACK_ROOM_SELECT,
      }),
      this.prisma.stay.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          status: StayStatus.IN_HOUSE,
        },
        select: ROOM_RACK_STAY_SELECT,
      }),
      this.prisma.roomBlock.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          status: 'ACTIVE',
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        select: ROOM_RACK_BLOCK_SELECT,
      }),
      this.prisma.reservation.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          status: ReservationStatus.CONFIRMED,
          roomId: { not: null },
          // The room rack always reflects the current operation, even when the
          // historical lists are showing another calendar day.
          checkInDate: { gte: operationalDateValue },
        },
        orderBy: [{ checkInDate: 'asc' }, { code: 'asc' }],
        take: 300,
        select: ROOM_RACK_ARRIVAL_SELECT,
      }),
    ]);

    return buildRoomRack(rooms, activeStays, blocks, upcoming);
  }
}

function buildRoomRack(
  rooms: RoomRackRoom[],
  activeStays: RoomRackStay[],
  blocks: RoomRackBlock[],
  upcoming: RoomRackArrival[],
): RoomRackItem[] {
  const stayByRoom = new Map(activeStays.map((stay) => [stay.roomId, stay]));
  const blockByRoom = new Map(blocks.map((block) => [block.roomId, block]));
  const nextArrivalByRoom = new Map<string, RoomRackArrival>();
  for (const reservation of upcoming) {
    if (reservation.roomId !== null && !nextArrivalByRoom.has(reservation.roomId)) {
      nextArrivalByRoom.set(reservation.roomId, reservation);
    }
  }

  return rooms.map((room) => {
    const stay = stayByRoom.get(room.id);
    const block = blockByRoom.get(room.id);
    const next = nextArrivalByRoom.get(room.id);
    return {
      id: room.id,
      number: room.number,
      floor: room.floor,
      building: room.building,
      roomType: room.roomType,
      housekeepingState: room.housekeepingState,
      operationalState: room.operationalState,
      occupancy: stay === undefined ? 'VACANT' : 'OCCUPIED',
      currentStay:
        stay === undefined
          ? null
          : {
              id: stay.id,
              reservationId: stay.reservationId,
              code: stay.reservation.code,
              guestName: stay.guest.fullName,
              checkOutDate: formatCalendarDate(stay.reservation.checkOutDate),
            },
      activeBlock:
        block === undefined ? null : { id: block.id, type: block.type, endsAt: block.endsAt },
      nextArrival:
        next === undefined
          ? null
          : {
              reservationId: next.id,
              code: next.code,
              guestName: next.guest.fullName,
              checkInDate: formatCalendarDate(next.checkInDate),
            },
    };
  });
}
