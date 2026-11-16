import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  HousekeepingState,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  Prisma,
  ReservationStatus,
  RoomOperationalState,
  StayStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { addCalendarDays, propertyDayStart } from '../common/time/property-day';
import { requirePropertyContext, RoomStateService } from '../inventory/room-state.service';
import { computeOperationalDay } from '../operational-day/operational-day';
import { PrismaService } from '../prisma/prisma.service';
import {
  formatCalendarDate,
  nightsBetween,
  parseCalendarDate,
} from '../reservations/reservation-dates';
import { evaluatePartyReadiness } from '../reservations/reservation-party';
import {
  CheckOutDto,
  CreateIncidentDto,
  FrontOfficeOverviewQueryDto,
  ListIncidentsQueryDto,
  MoveStayRoomDto,
  NoShowDto,
  ResolveIncidentDto,
} from './dto/front-office.dto';

type Transaction = Prisma.TransactionClient;

/**
 * Housekeeping states that block a normal check-in. `CLEAN` is accepted even
 * though inspection has not been recorded: whether pending inspection blocks
 * check-in is a property policy decision, so the default is reversible and
 * documented as an open question. DIRTY/CLEANING always block.
 */
export const CHECK_IN_BLOCKED_HOUSEKEEPING_STATES: HousekeepingState[] = [
  HousekeepingState.DIRTY,
  HousekeepingState.CLEANING,
];

const RESERVATION_SUMMARY_SELECT = {
  id: true,
  code: true,
  status: true,
  checkInDate: true,
  checkOutDate: true,
  adults: true,
  children: true,
  notes: true,
  roomId: true,
  guestId: true,
  roomTypeId: true,
  guest: { select: { id: true, fullName: true, email: true, phone: true } },
  roomType: { select: { id: true, name: true, code: true } },
  room: { select: { id: true, number: true, floor: true, building: true } },
} as const;

const STAY_SELECT = {
  id: true,
  organizationId: true,
  propertyId: true,
  reservationId: true,
  guestId: true,
  roomId: true,
  status: true,
  checkedInAt: true,
  checkedOutAt: true,
  checkOutNotes: true,
  moveCount: true,
  createdAt: true,
  updatedAt: true,
  guest: { select: { id: true, fullName: true, email: true, phone: true } },
  room: { select: { id: true, number: true, floor: true, building: true } },
  reservation: {
    select: {
      id: true,
      code: true,
      status: true,
      checkInDate: true,
      checkOutDate: true,
      adults: true,
      children: true,
      notes: true,
      roomType: { select: { id: true, name: true, code: true } },
    },
  },
} as const;

const INCIDENT_SELECT = {
  id: true,
  organizationId: true,
  propertyId: true,
  roomId: true,
  reservationId: true,
  stayId: true,
  type: true,
  severity: true,
  status: true,
  title: true,
  description: true,
  resolution: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  room: { select: { id: true, number: true } },
  reservation: { select: { id: true, code: true } },
  stay: { select: { id: true, status: true } },
  createdBy: { select: { id: true, name: true } },
  resolvedBy: { select: { id: true, name: true } },
} as const;

type ReservationSummaryRow = Prisma.ReservationGetPayload<{
  select: typeof RESERVATION_SUMMARY_SELECT;
}>;
type StayRow = Prisma.StayGetPayload<{ select: typeof STAY_SELECT }>;
type IncidentRow = Prisma.IncidentGetPayload<{ select: typeof INCIDENT_SELECT }>;

export interface ReservationSummaryResponse {
  id: string;
  code: string;
  status: ReservationStatus;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  adults: number;
  children: number;
  notes: string | null;
  roomId: string | null;
  guest: { id: string; fullName: string; email: string | null; phone: string | null };
  roomType: { id: string; name: string; code: string };
  room: { id: string; number: string; floor: string | null; building: string | null } | null;
}

export interface StayResponse {
  id: string;
  status: StayStatus;
  checkedInAt: Date;
  checkedOutAt: Date | null;
  checkOutNotes: string | null;
  moveCount: number;
  guest: { id: string; fullName: string; email: string | null; phone: string | null };
  room: { id: string; number: string; floor: string | null; building: string | null };
  reservation: {
    id: string;
    code: string;
    status: ReservationStatus;
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    adults: number;
    children: number;
    notes: string | null;
    roomType: { id: string; name: string; code: string };
  };
}

export interface RoomRackItem {
  id: string;
  number: string;
  floor: string | null;
  building: string | null;
  roomType: { id: string; name: string; code: string };
  housekeepingState: string;
  operationalState: string;
  occupancy: 'VACANT' | 'OCCUPIED';
  currentStay: {
    id: string;
    reservationId: string;
    code: string;
    guestName: string;
    checkOutDate: string;
  } | null;
  activeBlock: { id: string; type: string; endsAt: Date } | null;
  nextArrival: {
    reservationId: string;
    code: string;
    guestName: string;
    checkInDate: string;
  } | null;
}

export interface FrontOfficeOverview {
  operationalDate: string;
  selectedDate: string;
  isHistorical: boolean;
  localDate: string;
  localTime: string;
  timezone: string;
  operationalDayStart: string;
  counts: {
    arrivals: number;
    departures: number;
    inHouse: number;
    noShowCandidates: number;
    vacantRooms: number;
    occupiedRooms: number;
  };
  arrivals: ReservationSummaryResponse[];
  departures: StayResponse[];
  inHouse: StayResponse[];
  noShowCandidates: ReservationSummaryResponse[];
  roomRack: RoomRackItem[];
}

export interface CheckInRoomOption {
  id: string;
  number: string;
  floor: string | null;
  building: string | null;
  roomType: { id: string; name: string; code: string };
  housekeepingState: HousekeepingState;
  operationalState: RoomOperationalState;
  occupancy: 'VACANT' | 'OCCUPIED';
  activeBlock: { id: string; type: string; endsAt: Date } | null;
  eligible: boolean;
  reasons: string[];
}

export interface CheckInReadiness {
  reservation: ReservationSummaryResponse;
  housekeepingPolicy: {
    blockedStates: HousekeepingState[];
    inspectionPendingBlocksCheckIn: boolean;
  };
  currentRoomId: string | null;
  currentRoomEligible: boolean | null;
  rooms: CheckInRoomOption[];
}

export interface IncidentResponse {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  resolution: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  room: { id: string; number: string } | null;
  reservation: { id: string; code: string } | null;
  stay: { id: string; status: StayStatus } | null;
  createdBy: { id: string; name: string } | null;
  resolvedBy: { id: string; name: string } | null;
}

@Injectable()
export class FrontOfficeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly roomState: RoomStateService,
  ) {}

  async overview(
    context: TenantContext,
    query: FrontOfficeOverviewQueryDto,
  ): Promise<FrontOfficeOverview> {
    const propertyId = requirePropertyContext(context);
    const property = await this.loadProperty(context.organizationId, propertyId);
    const operationalDay = computeOperationalDay(
      new Date(),
      property.timezone,
      property.operationalDayStart,
    );
    const date = query.date ?? operationalDay.operationalDate;
    const dateValue = parseCalendarDate(date, 'date');
    const operationalDateValue = parseCalendarDate(
      operationalDay.operationalDate,
      'operationalDate',
    );
    const now = new Date();
    const isHistorical = date < operationalDay.operationalDate;
    const dayStart = isHistorical ? propertyDayStart(date, property.timezone) : null;
    const dayEnd = isHistorical
      ? propertyDayStart(addCalendarDays(date, 1), property.timezone)
      : null;

    // Historical days show what happened, not what still needs attention: arrivals for
    // that calendar day regardless of final status, stays active during that day, and
    // check-outs registered during that day. Current-day views keep their pending-work
    // semantics. Instant-based bounds use the property timezone, not UTC midnights.
    const [arrivals, departures, inHouse, noShowCandidates] =
      isHistorical && dayStart !== null && dayEnd !== null
        ? await Promise.all([
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
                checkedOutAt: { gte: dayStart, lt: dayEnd },
              },
              orderBy: [{ checkedOutAt: 'asc' }, { id: 'asc' }],
              take: 200,
              select: STAY_SELECT,
            }),
            this.prisma.stay.findMany({
              where: {
                organizationId: context.organizationId,
                propertyId,
                checkedInAt: { lt: dayEnd },
                OR: [{ checkedOutAt: null }, { checkedOutAt: { gte: dayStart } }],
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
          ])
        : await Promise.all([
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

    const [rooms, activeStays, blocks, upcoming] = await Promise.all([
      this.prisma.room.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          status: 'ACTIVE',
        },
        orderBy: [{ number: 'asc' }, { id: 'asc' }],
        take: 300,
        select: {
          id: true,
          number: true,
          floor: true,
          building: true,
          housekeepingState: true,
          operationalState: true,
          roomType: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.stay.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          status: StayStatus.IN_HOUSE,
        },
        select: {
          id: true,
          roomId: true,
          reservationId: true,
          guest: { select: { fullName: true } },
          reservation: { select: { code: true, checkOutDate: true } },
        },
      }),
      this.prisma.roomBlock.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          status: 'ACTIVE',
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        select: { id: true, roomId: true, type: true, endsAt: true },
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
        select: {
          id: true,
          code: true,
          roomId: true,
          checkInDate: true,
          guest: { select: { fullName: true } },
        },
      }),
    ]);

    const stayByRoom = new Map(activeStays.map((stay) => [stay.roomId, stay]));
    const blockByRoom = new Map(blocks.map((block) => [block.roomId, block]));
    const nextArrivalByRoom = new Map<string, (typeof upcoming)[number]>();
    for (const reservation of upcoming) {
      if (reservation.roomId !== null && !nextArrivalByRoom.has(reservation.roomId)) {
        nextArrivalByRoom.set(reservation.roomId, reservation);
      }
    }

    const roomRack: RoomRackItem[] = rooms.map((room) => {
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

    return {
      operationalDate: operationalDay.operationalDate,
      selectedDate: date,
      isHistorical,
      localDate: operationalDay.localDate,
      localTime: operationalDay.localTime,
      timezone: operationalDay.timezone,
      operationalDayStart: operationalDay.operationalDayStart,
      counts: {
        arrivals: arrivals.length,
        departures: departures.length,
        inHouse: inHouse.length,
        noShowCandidates: noShowCandidates.length,
        vacantRooms: roomRack.filter((room) => room.occupancy === 'VACANT').length,
        occupiedRooms: roomRack.filter((room) => room.occupancy === 'OCCUPIED').length,
      },
      arrivals: arrivals.map(mapReservationSummary),
      departures: departures.map(mapStay),
      inHouse: inHouse.map(mapStay),
      noShowCandidates: noShowCandidates.map(mapReservationSummary),
      roomRack,
    };
  }

  /**
   * Read-only check-in checklist for the guided front-desk flow. It mirrors the
   * backend rules used by `checkIn` so the operator sees why a room is not
   * selectable, but the confirmation transaction remains the authority.
   */
  async checkInReadiness(
    context: TenantContext,
    reservationId: string,
  ): Promise<CheckInReadiness> {
    const propertyId = requirePropertyContext(context);
    await this.roomState.reconcileProperty({
      organizationId: context.organizationId,
      propertyId,
      correlationId: context.correlationId,
    });

    const reservation = await this.prisma.reservation.findFirst({
      where: {
        id: reservationId,
        organizationId: context.organizationId,
        propertyId,
      },
      select: RESERVATION_SUMMARY_SELECT,
    });
    if (reservation === null) {
      throw new NotFoundException({
        code: 'reservation_not_found',
        message: 'Reservation not found in the selected property.',
      });
    }

    const rooms = await this.prisma.room.findMany({
      where: {
        organizationId: context.organizationId,
        propertyId,
        status: 'ACTIVE',
        roomTypeId: reservation.roomTypeId,
      },
      orderBy: [{ number: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        number: true,
        floor: true,
        building: true,
        housekeepingState: true,
        operationalState: true,
        roomType: { select: { id: true, name: true, code: true } },
      },
    });

    if (rooms.length === 0) {
      return {
        reservation: mapReservationSummary(reservation),
        housekeepingPolicy: {
          blockedStates: CHECK_IN_BLOCKED_HOUSEKEEPING_STATES,
          inspectionPendingBlocksCheckIn: false,
        },
        currentRoomId: reservation.roomId,
        currentRoomEligible: reservation.roomId === null ? null : false,
        rooms: [],
      };
    }

    const roomIds = rooms.map((room) => room.id);
    const [stays, blocks, overlapping] = await Promise.all([
      this.prisma.stay.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          roomId: { in: roomIds },
          status: StayStatus.IN_HOUSE,
        },
        select: { roomId: true },
      }),
      this.prisma.roomBlock.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          roomId: { in: roomIds },
          status: 'ACTIVE',
          startsAt: { lt: reservation.checkOutDate },
          endsAt: { gt: reservation.checkInDate },
        },
        select: { id: true, roomId: true, type: true, endsAt: true },
        orderBy: [{ endsAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.reservation.findMany({
        where: {
          organizationId: context.organizationId,
          propertyId,
          roomId: { in: roomIds },
          id: { not: reservation.id },
          status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
          checkInDate: { lt: reservation.checkOutDate },
          checkOutDate: { gt: reservation.checkInDate },
        },
        select: { roomId: true },
      }),
    ]);

    const occupiedRooms = new Set(stays.map((stay) => stay.roomId));
    const overlappingRooms = new Set(
      overlapping.map((row) => row.roomId).filter((value): value is string => value !== null),
    );
    const blockByRoom = new Map<string, (typeof blocks)[number]>();
    for (const block of blocks) {
      if (!blockByRoom.has(block.roomId)) {
        blockByRoom.set(block.roomId, block);
      }
    }

    const options: CheckInRoomOption[] = rooms.map((room) => {
      const reasons: string[] = [];
      if (room.operationalState !== RoomOperationalState.AVAILABLE) {
        reasons.push('ROOM_OUT_OF_SERVICE');
      }
      if (blockByRoom.has(room.id)) {
        reasons.push('ROOM_BLOCKED');
      }
      if (occupiedRooms.has(room.id)) {
        reasons.push('ROOM_OCCUPIED');
      }
      if (overlappingRooms.has(room.id)) {
        reasons.push('ROOM_NOT_AVAILABLE');
      }
      if (CHECK_IN_BLOCKED_HOUSEKEEPING_STATES.includes(room.housekeepingState)) {
        reasons.push('HOUSEKEEPING_NOT_READY');
      }
      const block = blockByRoom.get(room.id);
      return {
        id: room.id,
        number: room.number,
        floor: room.floor,
        building: room.building,
        roomType: room.roomType,
        housekeepingState: room.housekeepingState,
        operationalState: room.operationalState,
        occupancy: occupiedRooms.has(room.id) ? 'OCCUPIED' : 'VACANT',
        activeBlock:
          block === undefined ? null : { id: block.id, type: block.type, endsAt: block.endsAt },
        eligible: reasons.length === 0,
        reasons,
      };
    });

    const current = options.find((room) => room.id === reservation.roomId);

    return {
      reservation: mapReservationSummary(reservation),
      housekeepingPolicy: {
        blockedStates: CHECK_IN_BLOCKED_HOUSEKEEPING_STATES,
        inspectionPendingBlocksCheckIn: false,
      },
      currentRoomId: reservation.roomId,
      currentRoomEligible: reservation.roomId === null ? null : current?.eligible === true,
      rooms: options,
    };
  }

  async checkIn(
    context: TenantContext,
    reservationId: string,
  ): Promise<{ reservation: ReservationSummaryResponse; stay: StayResponse }> {
    const propertyId = requirePropertyContext(context);
    const property = await this.loadProperty(context.organizationId, propertyId);
    const operationalDay = computeOperationalDay(
      new Date(),
      property.timezone,
      property.operationalDayStart,
    );

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const reservation = await this.lockReservation(
          transaction,
          context.organizationId,
          propertyId,
          reservationId,
        );

        if (reservation.status === ReservationStatus.CHECKED_IN) {
          const existing = await transaction.stay.findUnique({
            where: { reservationId: reservation.id },
            select: STAY_SELECT,
          });
          if (existing === null) {
            throw new ConflictException({
              code: 'stay_inconsistent',
              message: 'Reservation is checked in but has no stay record.',
            });
          }
          return { reservation: mapReservationSummary(reservation), stay: mapStay(existing) };
        }

        if (reservation.status !== ReservationStatus.CONFIRMED) {
          throw new ConflictException({
            code: 'reservation_not_check_in_eligible',
            message: 'Only confirmed reservations can be checked in.',
            details: { status: reservation.status },
          });
        }

        const checkInDate = formatCalendarDate(reservation.checkInDate);
        const checkOutDate = formatCalendarDate(reservation.checkOutDate);
        // Check-in follows the local calendar date, not the operational day:
        // an early-morning arrival is still arriving on that calendar date.
        if (operationalDay.localDate < checkInDate) {
          throw new ConflictException({
            code: 'check_in_too_early',
            message: 'The reservation cannot be checked in before its arrival date.',
            details: { checkInDate, localDate: operationalDay.localDate },
          });
        }
        if (operationalDay.localDate >= checkOutDate) {
          throw new ConflictException({
            code: 'check_in_window_elapsed',
            message: 'The reservation check-in window has elapsed.',
            details: { checkOutDate, localDate: operationalDay.localDate },
          });
        }

        if (reservation.roomId === null) {
          throw new ConflictException({
            code: 'reservation_room_required',
            message: 'Assign a room to the reservation before checking in.',
          });
        }

        const party = await transaction.reservationGuest.findMany({
          where: {
            organizationId: context.organizationId,
            propertyId,
            reservationId: reservation.id,
          },
          select: {
            id: true,
            guestId: true,
            role: true,
            legalIncapacity: true,
            minorSupervision: true,
            authorizationReference: true,
            responsibleReservationGuestId: true,
            guest: {
              select: {
                documentType: true,
                documentNumber: true,
                fnrhProfile: { select: { birthDate: true } },
              },
            },
          },
        });
        if (party.length > 0) {
          const readiness = evaluatePartyReadiness({
            members: party.map((row) => ({
              id: row.id,
              guestId: row.guestId,
              role: row.role,
              birthDate: row.guest.fnrhProfile?.birthDate ?? null,
              documentType: row.guest.documentType,
              documentNumber: row.guest.documentNumber,
              legalIncapacity: row.legalIncapacity,
              minorSupervision: row.minorSupervision,
              authorizationReference: row.authorizationReference,
              responsibleReservationGuestId: row.responsibleReservationGuestId,
            })),
            checkInDate: reservation.checkInDate,
            primaryGuestId: reservation.guestId,
            declaredAdults: reservation.adults,
            declaredChildren: reservation.children,
          });
          if (readiness.checkInBlocked) {
            throw new ConflictException({
              code: 'reservation_party_check_in_blocked',
              message: 'Resolve the reservation party legal block before checking in.',
              details: { codes: readiness.legalCodes },
            });
          }
        }

        const room = await this.lockRoom(
          transaction,
          context.organizationId,
          propertyId,
          reservation.roomId,
        );

        if (room.status !== 'ACTIVE') {
          throw new ConflictException({
            code: 'room_inactive',
            message: 'The assigned room is not active.',
          });
        }
        if (room.operationalState !== 'AVAILABLE') {
          throw new ConflictException({
            code: 'room_out_of_service',
            message: 'The assigned room is not operationally available.',
            details: { operationalState: room.operationalState },
          });
        }
        if (CHECK_IN_BLOCKED_HOUSEKEEPING_STATES.includes(room.housekeepingState)) {
          throw new ConflictException({
            code: 'room_housekeeping_not_ready',
            message: 'The assigned room is not clean enough for check-in.',
            details: { housekeepingState: room.housekeepingState },
          });
        }

        const now = new Date();
        const blocking = await transaction.roomBlock.findFirst({
          where: {
            organizationId: context.organizationId,
            propertyId,
            roomId: room.id,
            status: 'ACTIVE',
            startsAt: { lte: now },
            endsAt: { gt: now },
          },
          select: { id: true, type: true, endsAt: true },
        });
        if (blocking !== null) {
          throw new ConflictException({
            code: 'room_out_of_service',
            message: 'The assigned room has an active operational block.',
            details: {
              blockId: blocking.id,
              type: blocking.type,
              endsAt: blocking.endsAt,
            },
          });
        }

        const occupied = await transaction.stay.findFirst({
          where: {
            organizationId: context.organizationId,
            propertyId,
            roomId: room.id,
            status: StayStatus.IN_HOUSE,
          },
          select: { id: true, reservationId: true },
        });
        if (occupied !== null) {
          throw new ConflictException({
            code: 'room_occupied',
            message: 'The room already has an in-house stay.',
            details: { stayId: occupied.id, reservationId: occupied.reservationId },
          });
        }

        const stay = await transaction.stay.create({
          data: {
            organizationId: context.organizationId,
            propertyId,
            reservationId: reservation.id,
            guestId: reservation.guestId,
            roomId: room.id,
            status: StayStatus.IN_HOUSE,
            checkedInAt: now,
            checkedInByUserId: context.actor.id,
          },
          select: STAY_SELECT,
        });

        const updated = await transaction.reservation.update({
          where: { id: reservation.id },
          data: { status: ReservationStatus.CHECKED_IN },
          select: RESERVATION_SUMMARY_SELECT,
        });

        await transaction.reservationHistory.create({
          data: {
            organizationId: context.organizationId,
            propertyId,
            reservationId: reservation.id,
            action: 'reservation.checked_in',
            fromStatus: ReservationStatus.CONFIRMED,
            toStatus: ReservationStatus.CHECKED_IN,
            fromRoomId: reservation.roomId,
            toRoomId: room.id,
            reason: 'Guest checked in at front office.',
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
            action: 'reservation.checked_in',
            entityType: 'Reservation',
            entityId: reservation.id,
            correlationId: context.correlationId,
            metadata: {
              code: reservation.code,
              stayId: stay.id,
              roomId: room.id,
              localDate: operationalDay.localDate,
              operationalDate: operationalDay.operationalDate,
            },
          },
          transaction,
        );

        return { reservation: mapReservationSummary(updated), stay: mapStay(stay) };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.stay.findUnique({
          where: { reservationId },
          select: STAY_SELECT,
        });
        if (existing !== null) {
          return {
            reservation: mapReservationSummary(
              await this.prisma.reservation.findFirstOrThrow({
                where: { id: reservationId },
                select: RESERVATION_SUMMARY_SELECT,
              }),
            ),
            stay: mapStay(existing),
          };
        }
        throw new ConflictException({
          code: 'stay_conflict',
          message: 'A stay already exists for this reservation.',
        });
      }
      throw error;
    }
  }

  async checkOut(context: TenantContext, stayId: string, dto: CheckOutDto): Promise<StayResponse> {
    const propertyId = requirePropertyContext(context);

    return this.prisma.$transaction(async (transaction) => {
      const stay = await this.lockStay(transaction, context.organizationId, propertyId, stayId);

      if (stay.status === StayStatus.CHECKED_OUT) {
        return mapStay(stay);
      }

      if (stay.status !== StayStatus.IN_HOUSE) {
        throw new ConflictException({
          code: 'stay_not_check_out_eligible',
          message: 'Only in-house stays can be checked out.',
          details: { status: stay.status },
        });
      }

      const now = new Date();
      const updated = await transaction.stay.update({
        where: { id: stay.id },
        data: {
          status: StayStatus.CHECKED_OUT,
          checkedOutAt: now,
          checkedOutByUserId: context.actor.id,
          ...(dto.notes !== undefined ? { checkOutNotes: dto.notes.trim() } : {}),
        },
        select: STAY_SELECT,
      });

      await transaction.reservation.update({
        where: { id: stay.reservationId },
        data: { status: ReservationStatus.CHECKED_OUT },
        select: { id: true },
      });

      await transaction.reservationHistory.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          reservationId: stay.reservationId,
          action: 'reservation.checked_out',
          fromStatus: ReservationStatus.CHECKED_IN,
          toStatus: ReservationStatus.CHECKED_OUT,
          fromRoomId: stay.roomId,
          toRoomId: stay.roomId,
          reason: dto.notes?.trim() ?? 'Guest checked out at front office.',
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
          action: 'reservation.checked_out',
          entityType: 'Reservation',
          entityId: stay.reservationId,
          correlationId: context.correlationId,
          metadata: {
            code: stay.reservation.code,
            stayId: stay.id,
            roomId: stay.roomId,
          },
        },
        transaction,
      );

      return mapStay(updated);
    });
  }

  async moveRoom(
    context: TenantContext,
    stayId: string,
    dto: MoveStayRoomDto,
  ): Promise<StayResponse> {
    const propertyId = requirePropertyContext(context);
    const reason = dto.reason?.trim() ?? 'Room move.';

    return this.prisma.$transaction(async (transaction) => {
      const stay = await this.lockStay(transaction, context.organizationId, propertyId, stayId);

      if (stay.status !== StayStatus.IN_HOUSE) {
        throw new ConflictException({
          code: 'stay_not_in_house',
          message: 'Only in-house stays can change rooms.',
          details: { status: stay.status },
        });
      }

      if (stay.roomId === dto.roomId) {
        return mapStay(stay);
      }

      const room = await this.lockRoom(transaction, context.organizationId, propertyId, dto.roomId);

      if (room.status !== 'ACTIVE') {
        throw new ConflictException({
          code: 'room_inactive',
          message: 'The selected room is not active.',
        });
      }
      if (room.operationalState !== 'AVAILABLE') {
        throw new ConflictException({
          code: 'room_out_of_service',
          message: 'The selected room is not operationally available.',
        });
      }
      if (room.roomTypeId !== stay.reservation.roomType.id) {
        throw new ConflictException({
          code: 'room_type_mismatch',
          message: 'The selected room does not belong to the reservation room type.',
        });
      }

      const now = new Date();
      const blocking = await transaction.roomBlock.findFirst({
        where: {
          organizationId: context.organizationId,
          propertyId,
          roomId: room.id,
          status: 'ACTIVE',
          startsAt: { lt: stay.reservation.checkOutDate },
          endsAt: { gt: now },
        },
        select: { id: true, type: true },
      });
      if (blocking !== null) {
        throw new ConflictException({
          code: 'room_block_overlap',
          message: 'The selected room has an active operational block.',
          details: { blockId: blocking.id, type: blocking.type },
        });
      }

      const occupied = await transaction.stay.findFirst({
        where: {
          organizationId: context.organizationId,
          propertyId,
          roomId: room.id,
          status: StayStatus.IN_HOUSE,
          id: { not: stay.id },
        },
        select: { id: true, reservationId: true },
      });
      if (occupied !== null) {
        throw new ConflictException({
          code: 'room_occupied',
          message: 'The selected room already has an in-house stay.',
          details: { stayId: occupied.id },
        });
      }

      const overlap = await transaction.reservation.findFirst({
        where: {
          organizationId: context.organizationId,
          propertyId,
          roomId: room.id,
          id: { not: stay.reservationId },
          status: {
            in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
          },
          checkInDate: { lt: stay.reservation.checkOutDate },
          checkOutDate: { gt: stay.reservation.checkInDate },
        },
        select: { id: true, code: true },
      });
      if (overlap !== null) {
        throw new ConflictException({
          code: 'room_not_available',
          message: 'The selected room has an overlapping reservation.',
          details: { reservationId: overlap.id, code: overlap.code },
        });
      }

      const updated = await transaction.stay.update({
        where: { id: stay.id },
        data: {
          roomId: room.id,
          moveCount: { increment: 1 },
        },
        select: STAY_SELECT,
      });

      await transaction.reservation.update({
        where: { id: stay.reservationId },
        data: { roomId: room.id },
        select: { id: true },
      });

      await transaction.reservationHistory.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          reservationId: stay.reservationId,
          action: 'reservation.room_moved',
          fromStatus: stay.reservation.status,
          toStatus: stay.reservation.status,
          fromRoomId: stay.roomId,
          toRoomId: room.id,
          reason,
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
          action: 'reservation.room_moved',
          entityType: 'Reservation',
          entityId: stay.reservationId,
          correlationId: context.correlationId,
          reason,
          metadata: {
            code: stay.reservation.code,
            stayId: stay.id,
            fromRoomId: stay.roomId,
            toRoomId: room.id,
          },
        },
        transaction,
      );

      return mapStay(updated);
    });
  }

  async noShow(
    context: TenantContext,
    reservationId: string,
    dto: NoShowDto,
  ): Promise<ReservationSummaryResponse> {
    const propertyId = requirePropertyContext(context);
    const property = await this.loadProperty(context.organizationId, propertyId);
    const operationalDay = computeOperationalDay(
      new Date(),
      property.timezone,
      property.operationalDayStart,
    );
    const reason = dto.reason?.trim() ?? 'Guest did not arrive.';

    return this.prisma.$transaction(async (transaction) => {
      const reservation = await this.lockReservation(
        transaction,
        context.organizationId,
        propertyId,
        reservationId,
      );

      if (reservation.status === ReservationStatus.NO_SHOW) {
        return mapReservationSummary(reservation);
      }

      if (reservation.status !== ReservationStatus.CONFIRMED) {
        throw new ConflictException({
          code: 'reservation_not_no_show_eligible',
          message: 'Only confirmed reservations can be marked as no-show.',
          details: { status: reservation.status },
        });
      }

      const checkInDate = formatCalendarDate(reservation.checkInDate);
      if (operationalDay.localDate <= checkInDate) {
        throw new ConflictException({
          code: 'no_show_too_early',
          message: 'A no-show can only be recorded after the arrival date.',
          details: { checkInDate, localDate: operationalDay.localDate },
        });
      }

      const stay = await transaction.stay.findUnique({
        where: { reservationId: reservation.id },
        select: { id: true },
      });
      if (stay !== null) {
        throw new ConflictException({
          code: 'reservation_has_stay',
          message: 'The reservation already has a stay record.',
          details: { stayId: stay.id },
        });
      }

      const updated = await transaction.reservation.update({
        where: { id: reservation.id },
        data: {
          status: ReservationStatus.NO_SHOW,
          noShowAt: new Date(),
        },
        select: RESERVATION_SUMMARY_SELECT,
      });

      await transaction.reservationHistory.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          reservationId: reservation.id,
          action: 'reservation.no_show',
          fromStatus: ReservationStatus.CONFIRMED,
          toStatus: ReservationStatus.NO_SHOW,
          fromRoomId: reservation.roomId,
          toRoomId: reservation.roomId,
          reason,
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
          action: 'reservation.no_show',
          entityType: 'Reservation',
          entityId: reservation.id,
          correlationId: context.correlationId,
          reason,
          metadata: {
            code: reservation.code,
            checkInDate,
            roomId: reservation.roomId,
          },
        },
        transaction,
      );

      return mapReservationSummary(updated);
    });
  }

  async listIncidents(
    context: TenantContext,
    query: ListIncidentsQueryDto,
  ): Promise<{ items: IncidentResponse[] }> {
    const propertyId = requirePropertyContext(context);
    const take = Math.min(query.limit ?? 50, 100);
    const rows = await this.prisma.incident.findMany({
      where: {
        organizationId: context.organizationId,
        propertyId,
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(query.roomId !== undefined ? { roomId: query.roomId } : {}),
        ...(query.reservationId !== undefined ? { reservationId: query.reservationId } : {}),
        ...(query.stayId !== undefined ? { stayId: query.stayId } : {}),
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take,
      select: INCIDENT_SELECT,
    });

    return { items: rows.map(mapIncident) };
  }

  async createIncident(context: TenantContext, dto: CreateIncidentDto): Promise<IncidentResponse> {
    const propertyId = requirePropertyContext(context);

    return this.prisma.$transaction(async (transaction) => {
      let roomId = dto.roomId;
      let reservationId = dto.reservationId;

      if (dto.stayId !== undefined) {
        const stay = await transaction.stay.findFirst({
          where: {
            id: dto.stayId,
            organizationId: context.organizationId,
            propertyId,
          },
          select: { id: true, roomId: true, reservationId: true },
        });
        if (stay === null) {
          throw new NotFoundException({
            code: 'stay_not_found',
            message: 'Stay not found in the selected property.',
          });
        }
        if (
          (roomId !== undefined && roomId !== stay.roomId) ||
          (reservationId !== undefined && reservationId !== stay.reservationId)
        ) {
          throw new ConflictException({
            code: 'incident_scope_mismatch',
            message: 'The incident scope does not match the selected stay.',
          });
        }
        roomId = stay.roomId;
        reservationId = stay.reservationId;
      }

      if (roomId !== undefined) {
        await this.assertRoomInProperty(transaction, context.organizationId, propertyId, roomId);
      }
      if (reservationId !== undefined) {
        const reservation = await transaction.reservation.findFirst({
          where: {
            id: reservationId,
            organizationId: context.organizationId,
            propertyId,
          },
          select: { id: true, roomId: true },
        });
        if (reservation === null) {
          throw new NotFoundException({
            code: 'reservation_not_found',
            message: 'Reservation not found in the selected property.',
          });
        }
        if (roomId === undefined && reservation.roomId !== null) {
          roomId = reservation.roomId;
        }
      }

      const incident = await transaction.incident.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          roomId,
          reservationId,
          stayId: dto.stayId,
          type: dto.type ?? IncidentType.NOTE,
          severity: dto.severity ?? IncidentSeverity.MEDIUM,
          status: IncidentStatus.OPEN,
          title: dto.title.trim(),
          description: dto.description.trim(),
          createdByUserId: context.actor.id,
        },
        select: INCIDENT_SELECT,
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'incident.created',
          entityType: 'Incident',
          entityId: incident.id,
          correlationId: context.correlationId,
          metadata: {
            type: incident.type,
            severity: incident.severity,
            roomId: incident.roomId,
            reservationId: incident.reservationId,
            stayId: incident.stayId,
          },
        },
        transaction,
      );

      return mapIncident(incident);
    });
  }

  async resolveIncident(
    context: TenantContext,
    incidentId: string,
    dto: ResolveIncidentDto,
  ): Promise<IncidentResponse> {
    const propertyId = requirePropertyContext(context);
    const resolution = dto.resolution.trim();

    return this.prisma.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Incident"
        WHERE "id" = ${incidentId}::uuid
          AND "organizationId" = ${context.organizationId}::uuid
          AND "propertyId" = ${propertyId}::uuid
        FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new NotFoundException({
          code: 'incident_not_found',
          message: 'Incident not found in the selected property.',
        });
      }

      const current = await transaction.incident.findFirstOrThrow({
        where: { id: incidentId },
        select: INCIDENT_SELECT,
      });
      if (current.status === IncidentStatus.RESOLVED) {
        return mapIncident(current);
      }

      const updated = await transaction.incident.update({
        where: { id: incidentId },
        data: {
          status: IncidentStatus.RESOLVED,
          resolution,
          resolvedAt: new Date(),
          resolvedByUserId: context.actor.id,
        },
        select: INCIDENT_SELECT,
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'incident.resolved',
          entityType: 'Incident',
          entityId: updated.id,
          correlationId: context.correlationId,
          metadata: {
            type: updated.type,
            severity: updated.severity,
            roomId: updated.roomId,
          },
        },
        transaction,
      );

      return mapIncident(updated);
    });
  }

  private async loadProperty(organizationId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId, status: 'ACTIVE' },
      select: {
        id: true,
        timezone: true,
        operationalDayStart: true,
      },
    });
    if (property === null) {
      throw new NotFoundException({
        code: 'property_not_found',
        message: 'Property not found.',
      });
    }
    return property;
  }

  private async lockReservation(
    transaction: Transaction,
    organizationId: string,
    propertyId: string,
    reservationId: string,
  ): Promise<ReservationSummaryRow> {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Reservation"
      WHERE "id" = ${reservationId}::uuid
        AND "organizationId" = ${organizationId}::uuid
        AND "propertyId" = ${propertyId}::uuid
      FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new NotFoundException({
        code: 'reservation_not_found',
        message: 'Reservation not found in the selected property.',
      });
    }
    return transaction.reservation.findFirstOrThrow({
      where: { id: reservationId },
      select: RESERVATION_SUMMARY_SELECT,
    });
  }

  private async lockStay(
    transaction: Transaction,
    organizationId: string,
    propertyId: string,
    stayId: string,
  ): Promise<StayRow> {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Stay"
      WHERE "id" = ${stayId}::uuid
        AND "organizationId" = ${organizationId}::uuid
        AND "propertyId" = ${propertyId}::uuid
      FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new NotFoundException({
        code: 'stay_not_found',
        message: 'Stay not found in the selected property.',
      });
    }
    return transaction.stay.findFirstOrThrow({
      where: { id: stayId },
      select: STAY_SELECT,
    });
  }

  private async lockRoom(
    transaction: Transaction,
    organizationId: string,
    propertyId: string,
    roomId: string,
  ): Promise<{
    id: string;
    status: string;
    operationalState: string;
    housekeepingState: HousekeepingState;
    roomTypeId: string;
  }> {
    await this.roomState.lockRoom(transaction, organizationId, propertyId, roomId);
    const room = await transaction.room.findFirst({
      where: { id: roomId, organizationId, propertyId },
      select: {
        id: true,
        status: true,
        operationalState: true,
        housekeepingState: true,
        roomTypeId: true,
      },
    });
    if (room === null) {
      throw new NotFoundException({
        code: 'room_not_found',
        message: 'Room not found in the selected property.',
      });
    }
    return room;
  }

  private async assertRoomInProperty(
    transaction: Transaction,
    organizationId: string,
    propertyId: string,
    roomId: string,
  ): Promise<void> {
    const room = await transaction.room.findFirst({
      where: { id: roomId, organizationId, propertyId },
      select: { id: true },
    });
    if (room === null) {
      throw new NotFoundException({
        code: 'room_not_found',
        message: 'Room not found in the selected property.',
      });
    }
  }
}

function mapReservationSummary(row: ReservationSummaryRow): ReservationSummaryResponse {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    checkInDate: formatCalendarDate(row.checkInDate),
    checkOutDate: formatCalendarDate(row.checkOutDate),
    nights: nightsBetween(row.checkInDate, row.checkOutDate),
    adults: row.adults,
    children: row.children,
    notes: row.notes,
    roomId: row.roomId,
    guest: row.guest,
    roomType: row.roomType,
    room: row.room,
  };
}

function mapStay(row: StayRow): StayResponse {
  return {
    id: row.id,
    status: row.status,
    checkedInAt: row.checkedInAt,
    checkedOutAt: row.checkedOutAt,
    checkOutNotes: row.checkOutNotes,
    moveCount: row.moveCount,
    guest: row.guest,
    room: row.room,
    reservation: {
      id: row.reservation.id,
      code: row.reservation.code,
      status: row.reservation.status,
      checkInDate: formatCalendarDate(row.reservation.checkInDate),
      checkOutDate: formatCalendarDate(row.reservation.checkOutDate),
      nights: nightsBetween(row.reservation.checkInDate, row.reservation.checkOutDate),
      adults: row.reservation.adults,
      children: row.reservation.children,
      notes: row.reservation.notes,
      roomType: row.reservation.roomType,
    },
  };
}

function mapIncident(row: IncidentRow): IncidentResponse {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    status: row.status,
    title: row.title,
    description: row.description,
    resolution: row.resolution,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    room: row.room,
    reservation: row.reservation,
    stay: row.stay,
    createdBy: row.createdBy,
    resolvedBy: row.resolvedBy,
  };
}
