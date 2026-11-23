import { Prisma, ReservationStatus } from '@prisma/client';
import { propertyDayBounds } from '../common/time/property-day';
import type { PrismaService } from '../prisma/prisma.service';
import type { ReportProperty } from './report-definitions';
import {
  MAX_ROWS,
  type BuiltReport,
  assertWithinLimit,
  calendarDate,
  formatDateTime,
  nights,
} from './reports.support';

const RESERVATION_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  CHECKED_IN: 'En casa',
  CHECKED_OUT: 'Check-out',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No-show',
};

interface ReservationReportRow {
  code: string;
  status: ReservationStatus;
  checkInDate: Date;
  checkOutDate: Date;
  adults: number;
  children: number;
  createdAt: Date;
  guest: { fullName: string };
  roomType: { name: string };
  room: { number: string } | null;
  stay: { checkedInAt: Date; checkedOutAt: Date | null } | null;
}

type CheckpointMode = 'arrival' | 'departure';

const reservationSelect = {
  code: true,
  status: true,
  checkInDate: true,
  checkOutDate: true,
  adults: true,
  children: true,
  createdAt: true,
  guest: { select: { fullName: true } },
  roomType: { select: { name: true } },
  room: { select: { number: true } },
  stay: { select: { checkedInAt: true, checkedOutAt: true } },
} satisfies Prisma.ReservationSelect;

export async function buildArrivalsReport(
  prisma: PrismaService,
  base: Omit<BuiltReport, 'summary' | 'rows'>,
  property: ReportProperty,
  filters: { from: string; to: string },
  fromDate: Date,
  toDate: Date,
): Promise<BuiltReport> {
  return buildCheckpointReport(prisma, base, property, filters, fromDate, toDate, 'arrival');
}

export async function buildDeparturesReport(
  prisma: PrismaService,
  base: Omit<BuiltReport, 'summary' | 'rows'>,
  property: ReportProperty,
  filters: { from: string; to: string },
  fromDate: Date,
  toDate: Date,
): Promise<BuiltReport> {
  return buildCheckpointReport(prisma, base, property, filters, fromDate, toDate, 'departure');
}

export async function buildReservationsReport(
  prisma: PrismaService,
  base: Omit<BuiltReport, 'summary' | 'rows'>,
  property: ReportProperty,
  filters: { from: string; to: string },
): Promise<BuiltReport> {
  const organizationId = base.organizationId;
  const bounds = propertyDayBounds(filters.from, filters.to, property.timezone);
  const reservations = await prisma.reservation.findMany({
    where: {
      organizationId,
      propertyId: property.id,
      ...(bounds.gte !== undefined || bounds.lt !== undefined
        ? {
            createdAt: {
              ...(bounds.gte !== undefined ? { gte: bounds.gte } : {}),
              ...(bounds.lt !== undefined ? { lt: bounds.lt } : {}),
            },
          }
        : {}),
    },
    take: MAX_ROWS + 1,
    orderBy: [{ createdAt: 'desc' }, { code: 'asc' }],
    select: reservationSelect,
  });
  assertWithinLimit(reservations.length);

  const rows = reservations.map((reservation) => ({
    ...reservationRow(reservation, property),
    createdAt: formatDateTime(reservation.createdAt, property.timezone),
    checkInDate: calendarDate(reservation.checkInDate),
    checkOutDate: calendarDate(reservation.checkOutDate),
    nights: nights(reservation.checkInDate, reservation.checkOutDate),
  }));
  const counts = reservationCounts(reservations, 'reservation');

  return {
    ...base,
    summary: [
      { key: 'created', label: 'Creadas', value: reservations.length, format: 'number' },
      { key: 'confirmed', label: 'Confirmadas', value: counts.confirmed, format: 'number' },
      { key: 'checkedIn', label: 'En casa', value: counts.checkedIn, format: 'number' },
      { key: 'checkedOut', label: 'Check-out', value: counts.checkedOut, format: 'number' },
      { key: 'cancelled', label: 'Canceladas', value: counts.cancelled, format: 'number' },
      { key: 'noShow', label: 'No-show', value: counts.noShow, format: 'number' },
    ],
    rows,
  };
}

async function buildCheckpointReport(
  prisma: PrismaService,
  base: Omit<BuiltReport, 'summary' | 'rows'>,
  property: ReportProperty,
  filters: { from: string; to: string },
  fromDate: Date,
  toDate: Date,
  mode: CheckpointMode,
): Promise<BuiltReport> {
  const organizationId = base.organizationId;
  const stayWindow = { gte: fromDate, lte: toDate };
  const reservations = await prisma.reservation.findMany({
    where: {
      organizationId,
      propertyId: property.id,
      ...(mode === 'arrival' ? { checkInDate: stayWindow } : { checkOutDate: stayWindow }),
    },
    take: MAX_ROWS + 1,
    orderBy:
      mode === 'arrival'
        ? [{ checkInDate: 'asc' }, { code: 'asc' }]
        : [{ checkOutDate: 'asc' }, { code: 'asc' }],
    select: reservationSelect,
  });
  assertWithinLimit(reservations.length);
  const rows = reservations.map((reservation) => reservationRow(reservation, property));
  const counts = reservationCounts(reservations, mode);

  return {
    ...base,
    summary: [
      { key: 'expected', label: 'Previstas', value: counts.expected, format: 'number' },
      {
        key: 'completed',
        label: mode === 'arrival' ? 'Realizadas' : 'Concluidas',
        value: counts.completed,
        format: 'number',
      },
      { key: 'pending', label: 'Pendientes', value: counts.pending, format: 'number' },
      { key: 'cancelled', label: 'Canceladas', value: counts.cancelled, format: 'number' },
      { key: 'noShow', label: 'No-show', value: counts.noShow, format: 'number' },
    ],
    rows,
  };
}

function reservationRow(
  reservation: ReservationReportRow,
  property: ReportProperty,
): Record<string, string | number | null> {
  return {
    date: calendarDate(reservation.checkInDate),
    code: reservation.code,
    guest: reservation.guest.fullName,
    roomType: reservation.roomType.name,
    room: reservation.room?.number ?? '—',
    nights: nights(reservation.checkInDate, reservation.checkOutDate),
    status: RESERVATION_STATUS_LABELS[reservation.status] ?? reservation.status,
    checkedInAt: reservation.stay?.checkedInAt
      ? formatDateTime(reservation.stay.checkedInAt, property.timezone)
      : '—',
    checkedOutAt: reservation.stay?.checkedOutAt
      ? formatDateTime(reservation.stay.checkedOutAt, property.timezone)
      : '—',
    checkInDate: calendarDate(reservation.checkInDate),
    checkOutDate: calendarDate(reservation.checkOutDate),
    createdAt: formatDateTime(reservation.createdAt, property.timezone),
  };
}

function reservationCounts(
  reservations: ReservationReportRow[],
  mode: 'arrival' | 'departure' | 'reservation',
): {
  expected: number;
  completed: number;
  pending: number;
  confirmed: number;
  checkedIn: number;
  checkedOut: number;
  cancelled: number;
  noShow: number;
} {
  const countByStatus = (status: ReservationStatus): number =>
    reservations.filter((reservation) => reservation.status === status).length;

  const cancelled = countByStatus(ReservationStatus.CANCELLED);
  const noShow = countByStatus(ReservationStatus.NO_SHOW);
  const checkedIn = countByStatus(ReservationStatus.CHECKED_IN);
  const checkedOut = countByStatus(ReservationStatus.CHECKED_OUT);
  const confirmed = countByStatus(ReservationStatus.CONFIRMED);

  const completed =
    mode === 'departure'
      ? reservations.filter((reservation) => reservation.stay?.checkedOutAt != null).length
      : reservations.filter(
          (reservation) =>
            reservation.status === ReservationStatus.CHECKED_IN ||
            reservation.status === ReservationStatus.CHECKED_OUT ||
            reservation.stay !== null,
        ).length;

  const pending =
    mode === 'departure'
      ? reservations.filter(
          (reservation) =>
            reservation.status === ReservationStatus.CONFIRMED ||
            (reservation.status === ReservationStatus.CHECKED_IN &&
              reservation.stay?.checkedOutAt === null),
        ).length
      : confirmed;

  return {
    expected: reservations.length - cancelled,
    completed,
    pending,
    confirmed,
    checkedIn,
    checkedOut,
    cancelled,
    noShow,
  };
}
