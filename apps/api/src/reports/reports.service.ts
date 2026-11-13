import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReservationStatus, StayStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import type { TenantContext } from '../common/http/request-context';
import { money } from '../common/money/decimal';
import { addCalendarDays, propertyDayBounds, propertyDayStart } from '../common/time/property-day';
import { csvCell } from '../exports/csv';
import { requirePropertyContext } from '../inventory/room-state.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseCalendarDate } from '../reservations/reservation-dates';
import type { ExportReportDto, ReportFiltersDto, RunReportDto } from './dto/report.dto';
import {
  REPORT_DEFINITIONS,
  isReportKey,
  reportDefinition,
  type ReportDefinition,
  type ReportProperty,
  type ReportResult,
  type ReportSummaryItem,
} from './report-definitions';
import { renderReportPdf } from './report-pdf';

const MAX_ROWS = 5000;
const MAX_RANGE_DAYS = 62;
const DEFAULT_PAGE_SIZE = 50;

const RESERVATION_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  CHECKED_IN: 'En casa',
  CHECKED_OUT: 'Check-out',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No-show',
};

interface BuiltReport {
  definition: ReportDefinition;
  organizationId: string;
  property: ReportProperty;
  generatedAt: Date;
  filters: { from: string; to: string };
  summary: ReportSummaryItem[];
  rows: Array<Record<string, string | number | null>>;
}

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

/**
 * Reports are deliberately synchronous and bounded in v1. The catalog is fixed
 * in code, every query is property-scoped, and clients never send SQL, column
 * names or arbitrary filters. Execution identifiers correlate the response with
 * an append-only audit event; report contents are not persisted.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async catalog(context: TenantContext): Promise<{
    items: Array<{
      key: string;
      title: string;
      description: string;
      category: string;
      permission: string;
      allowed: boolean;
    }>;
  }> {
    requirePropertyContext(context);
    return {
      items: REPORT_DEFINITIONS.map((definition) => ({
        key: definition.key,
        title: definition.title,
        description: definition.description,
        category: definition.category,
        permission: definition.permission,
        allowed: context.permissions.has(definition.permission),
      })),
    };
  }

  async history(context: TenantContext): Promise<{ items: Array<Record<string, unknown>> }> {
    const propertyId = requirePropertyContext(context);
    const rows = await this.prisma.auditEvent.findMany({
      where: {
        organizationId: context.organizationId,
        propertyId,
        action: { in: ['report.executed', 'report.exported'] },
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: { id: true, action: true, occurredAt: true, metadata: true },
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        action: row.action,
        occurredAt: row.occurredAt,
        metadata: row.metadata,
      })),
    };
  }

  async run(context: TenantContext, reportKey: string, dto: RunReportDto): Promise<ReportResult> {
    const definition = this.resolveDefinition(reportKey);
    this.assertPermission(context, definition);
    const propertyId = requirePropertyContext(context);
    const built = await this.build(context, definition, dto.filters);

    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? DEFAULT_PAGE_SIZE;
    const start = (page - 1) * pageSize;
    const executionId = randomUUID();
    const result = this.serialize(
      built,
      executionId,
      page,
      pageSize,
      built.rows.slice(start, start + pageSize),
    );

    await this.audit.append({
      organizationId: context.organizationId,
      propertyId,
      actorUserId: context.actor.id,
      action: 'report.executed',
      entityType: 'ReportExecution',
      entityId: executionId,
      correlationId: context.correlationId,
      metadata: {
        reportKey: definition.key,
        from: dto.filters.from,
        to: dto.filters.to,
        rowCount: result.totalRows,
        page,
        pageSize,
      },
    });

    return result;
  }

  async export(
    context: TenantContext,
    reportKey: string,
    dto: ExportReportDto,
  ): Promise<{ content: Buffer; mimeType: string; filename: string; rowCount: number }> {
    const definition = this.resolveDefinition(reportKey);
    this.assertPermission(context, definition);
    const propertyId = requirePropertyContext(context);
    const built = await this.build(context, definition, dto.filters);
    const executionId = randomUUID();
    const result = this.serialize(built, executionId, 1, MAX_ROWS, built.rows);

    const extension = dto.format === 'PDF' ? 'pdf' : 'csv';
    const content =
      dto.format === 'PDF'
        ? (await renderReportPdf(result)).buffer
        : Buffer.from(this.toCsv(built), 'utf8');

    await this.audit.append({
      organizationId: context.organizationId,
      propertyId,
      actorUserId: context.actor.id,
      action: 'report.exported',
      entityType: 'ReportExecution',
      entityId: executionId,
      correlationId: context.correlationId,
      metadata: {
        reportKey: definition.key,
        from: dto.filters.from,
        to: dto.filters.to,
        format: dto.format,
        rowCount: built.rows.length,
      },
    });

    return {
      content,
      mimeType: dto.format === 'PDF' ? 'application/pdf' : 'text/csv; charset=utf-8',
      filename: `nova-report-${definition.key}-${dto.filters.from}-${dto.filters.to}.${extension}`,
      rowCount: built.rows.length,
    };
  }

  private resolveDefinition(reportKey: string): ReportDefinition {
    if (!isReportKey(reportKey)) {
      throw new NotFoundException({
        code: 'report_not_found',
        message: 'The requested report is not part of the catalog.',
      });
    }
    return reportDefinition(reportKey);
  }

  private assertPermission(context: TenantContext, definition: ReportDefinition): void {
    if (!context.permissions.has(definition.permission)) {
      throw new ForbiddenException({
        code: 'permission_denied',
        message: 'You do not have permission to run this report.',
        details: { required: [definition.permission] },
      });
    }
  }

  private async build(
    context: TenantContext,
    definition: ReportDefinition,
    filters: ReportFiltersDto,
  ): Promise<BuiltReport> {
    const propertyId = requirePropertyContext(context);
    const fromDate = parseCalendarDate(filters.from, 'from');
    const toDate = parseCalendarDate(filters.to, 'to');
    const rangeDays = calendarDayCount(filters.from, filters.to);
    if (rangeDays < 1 || rangeDays > MAX_RANGE_DAYS) {
      throw new BadRequestException({
        code: 'report_filter_invalid',
        message: `El período debe tener entre 1 y ${MAX_RANGE_DAYS} días.`,
      });
    }

    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId: context.organizationId },
      select: {
        id: true,
        name: true,
        code: true,
        timezone: true,
        currencyCode: true,
      },
    });
    if (property === null) {
      throw new NotFoundException({
        code: 'property_not_found',
        message: 'Property not found in the current organization.',
      });
    }

    const generatedAt = new Date();
    const base = {
      definition,
      organizationId: context.organizationId,
      property,
      generatedAt,
      filters: { from: filters.from, to: filters.to },
    };

    switch (definition.key) {
      case 'occupancy':
        return this.buildOccupancy(base, property, filters);
      case 'arrivals':
        return this.buildArrivals(base, property, filters, fromDate, toDate);
      case 'departures':
        return this.buildDepartures(base, property, filters, fromDate, toDate);
      case 'reservations':
        return this.buildReservations(base, property, filters);
      case 'cash-daily':
        return this.buildCashDaily(base, property, filters, fromDate, toDate);
    }
  }

  private async buildOccupancy(
    base: Omit<BuiltReport, 'summary' | 'rows'>,
    property: ReportProperty,
    filters: { from: string; to: string },
  ): Promise<BuiltReport> {
    const organizationId = base.organizationId;
    const { gte, lt } = propertyDayBounds(filters.from, filters.to, property.timezone);
    const rangeStart = gte ?? propertyDayStart(filters.from, property.timezone);
    const rangeEnd = lt ?? propertyDayStart(addCalendarDays(filters.to, 1), property.timezone);

    const [rooms, stays, blocks] = await Promise.all([
      this.prisma.room.findMany({
        where: { organizationId, propertyId: property.id, status: 'ACTIVE' },
        take: MAX_ROWS + 1,
        select: { id: true },
      }),
      this.prisma.stay.findMany({
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
      this.prisma.roomBlock.findMany({
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
    this.assertWithinLimit(rooms.length);
    this.assertWithinLimit(stays.length);
    this.assertWithinLimit(blocks.length);

    const activeRoomIds = new Set(rooms.map((room) => room.id));
    const dayRows: Array<Record<string, string | number | null>> = [];
    let occupiedRoomNights = 0;
    let outOfServiceRoomNights = 0;
    let sellableRoomNights = 0;
    let availableRoomNights = 0;

    for (let offset = 0; offset < calendarDayCount(filters.from, filters.to); offset += 1) {
      const date = addCalendarDays(filters.from, offset);
      const dayStart = propertyDayStart(date, property.timezone);
      const dayEnd = propertyDayStart(addCalendarDays(date, 1), property.timezone);
      const dayStartMs = dayStart.getTime();
      const dayEndMs = dayEnd.getTime();

      const outOfServiceRoomIds = new Set(
        blocks
          .filter((block) => block.type === 'OUT_OF_ORDER' || block.type === 'OUT_OF_SERVICE')
          .filter((block) => {
            const effectiveEnd = block.releasedAt ?? block.endsAt;
            return (
              block.startsAt.getTime() < dayEndMs &&
              effectiveEnd.getTime() > dayStartMs &&
              activeRoomIds.has(block.roomId)
            );
          })
          .map((block) => block.roomId),
      );
      const occupiedRoomIds = new Set(
        stays
          .filter((stay) => activeRoomIds.has(stay.roomId))
          .filter(
            (stay) =>
              stay.checkedInAt.getTime() < dayEndMs &&
              (stay.checkedOutAt === null || stay.checkedOutAt.getTime() >= dayEndMs),
          )
          .map((stay) => stay.roomId),
      );

      const totalRooms = activeRoomIds.size;
      const outOfService = outOfServiceRoomIds.size;
      const sellable = Math.max(0, totalRooms - outOfService);
      const occupied = occupiedRoomIds.size;
      const available = Math.max(0, sellable - occupied);
      const occupancyRate = sellable > 0 ? round2((occupied / sellable) * 100) : 0;

      occupiedRoomNights += occupied;
      outOfServiceRoomNights += outOfService;
      sellableRoomNights += sellable;
      availableRoomNights += available;
      dayRows.push({
        date,
        totalRooms,
        outOfService,
        sellable,
        occupied,
        available,
        occupancyRate,
      });
    }

    return {
      ...base,
      summary: [
        {
          key: 'activeRooms',
          label: 'Habitaciones activas',
          value: activeRoomIds.size,
          format: 'number',
        },
        {
          key: 'occupiedRoomNights',
          label: 'Noches-cuarto ocupadas',
          value: occupiedRoomNights,
          format: 'number',
        },
        {
          key: 'sellableRoomNights',
          label: 'Noches-cuarto vendibles',
          value: sellableRoomNights,
          format: 'number',
        },
        {
          key: 'availableRoomNights',
          label: 'Noches-cuarto disponibles',
          value: availableRoomNights,
          format: 'number',
        },
        {
          key: 'outOfServiceRoomNights',
          label: 'Noches-cuarto fuera de servicio',
          value: outOfServiceRoomNights,
          format: 'number',
        },
        {
          key: 'averageOccupancy',
          label: 'Ocupación promedio',
          value:
            sellableRoomNights > 0 ? round2((occupiedRoomNights / sellableRoomNights) * 100) : 0,
          format: 'percent',
        },
      ],
      rows: dayRows,
    };
  }

  private async buildArrivals(
    base: Omit<BuiltReport, 'summary' | 'rows'>,
    property: ReportProperty,
    filters: { from: string; to: string },
    fromDate: Date,
    toDate: Date,
  ): Promise<BuiltReport> {
    const organizationId = base.organizationId;
    const reservations = await this.prisma.reservation.findMany({
      where: {
        organizationId,
        propertyId: property.id,
        checkInDate: { gte: fromDate, lte: toDate },
      },
      take: MAX_ROWS + 1,
      orderBy: [{ checkInDate: 'asc' }, { code: 'asc' }],
      select: reservationSelect,
    });
    this.assertWithinLimit(reservations.length);
    const rows = reservations.map((reservation) => this.reservationRow(reservation, property));
    const counts = this.reservationCounts(reservations, 'arrival');

    return {
      ...base,
      summary: [
        { key: 'expected', label: 'Previstas', value: counts.expected, format: 'number' },
        { key: 'completed', label: 'Realizadas', value: counts.completed, format: 'number' },
        { key: 'pending', label: 'Pendientes', value: counts.pending, format: 'number' },
        { key: 'cancelled', label: 'Canceladas', value: counts.cancelled, format: 'number' },
        { key: 'noShow', label: 'No-show', value: counts.noShow, format: 'number' },
      ],
      rows,
    };
  }

  private async buildDepartures(
    base: Omit<BuiltReport, 'summary' | 'rows'>,
    property: ReportProperty,
    filters: { from: string; to: string },
    fromDate: Date,
    toDate: Date,
  ): Promise<BuiltReport> {
    const organizationId = base.organizationId;
    const reservations = await this.prisma.reservation.findMany({
      where: {
        organizationId,
        propertyId: property.id,
        checkOutDate: { gte: fromDate, lte: toDate },
      },
      take: MAX_ROWS + 1,
      orderBy: [{ checkOutDate: 'asc' }, { code: 'asc' }],
      select: reservationSelect,
    });
    this.assertWithinLimit(reservations.length);
    const rows = reservations.map((reservation) => this.reservationRow(reservation, property));
    const counts = this.reservationCounts(reservations, 'departure');

    return {
      ...base,
      summary: [
        { key: 'expected', label: 'Previstas', value: counts.expected, format: 'number' },
        { key: 'completed', label: 'Concluidas', value: counts.completed, format: 'number' },
        { key: 'pending', label: 'Pendientes', value: counts.pending, format: 'number' },
        { key: 'cancelled', label: 'Canceladas', value: counts.cancelled, format: 'number' },
        { key: 'noShow', label: 'No-show', value: counts.noShow, format: 'number' },
      ],
      rows,
    };
  }

  private async buildReservations(
    base: Omit<BuiltReport, 'summary' | 'rows'>,
    property: ReportProperty,
    filters: { from: string; to: string },
  ): Promise<BuiltReport> {
    const organizationId = base.organizationId;
    const bounds = propertyDayBounds(filters.from, filters.to, property.timezone);
    const reservations = await this.prisma.reservation.findMany({
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
    this.assertWithinLimit(reservations.length);

    const rows = reservations.map((reservation) => ({
      ...this.reservationRow(reservation, property),
      createdAt: formatDateTime(reservation.createdAt, property.timezone),
      checkInDate: calendarDate(reservation.checkInDate),
      checkOutDate: calendarDate(reservation.checkOutDate),
      nights: nights(reservation.checkInDate, reservation.checkOutDate),
    }));
    const counts = this.reservationCounts(reservations, 'reservation');

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

  private async buildCashDaily(
    base: Omit<BuiltReport, 'summary' | 'rows'>,
    property: ReportProperty,
    filters: { from: string; to: string },
    fromDate: Date,
    toDate: Date,
  ): Promise<BuiltReport> {
    const organizationId = base.organizationId;
    const bounds = propertyDayBounds(filters.from, filters.to, property.timezone);
    const sessions = await this.prisma.cashSession.findMany({
      where: {
        organizationId,
        propertyId: property.id,
        operationalDate: { gte: fromDate, lte: toDate },
      },
      take: MAX_ROWS + 1,
      orderBy: [{ operationalDate: 'asc' }, { openedAt: 'asc' }],
      select: {
        id: true,
        name: true,
        status: true,
        operationalDate: true,
        openingAmount: true,
        expectedCashAmount: true,
        closingAmount: true,
      },
    });
    this.assertWithinLimit(sessions.length);

    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId,
        propertyId: property.id,
        status: 'COMPLETED',
        receivedAt: {
          ...(bounds.gte !== undefined ? { gte: bounds.gte } : {}),
          ...(bounds.lt !== undefined ? { lt: bounds.lt } : {}),
        },
      },
      take: MAX_ROWS + 1,
      orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
      select: { amount: true, method: true, receivedAt: true },
    });
    this.assertWithinLimit(payments.length);

    const sessionIds = sessions.map((session) => session.id);
    const movements =
      sessionIds.length === 0
        ? []
        : await this.prisma.cashMovement.groupBy({
            by: ['cashSessionId', 'type'],
            where: {
              organizationId,
              propertyId: property.id,
              cashSessionId: { in: sessionIds },
            },
            _sum: { amount: true },
          });

    const movementBySession = new Map<string, Map<string, Prisma.Decimal>>();
    for (const movement of movements) {
      const byType = movementBySession.get(movement.cashSessionId) ?? new Map();
      byType.set(movement.type, movement._sum.amount ?? new Prisma.Decimal(0));
      movementBySession.set(movement.cashSessionId, byType);
    }

    const paymentsByDate = new Map<string, Map<string, Prisma.Decimal>>();
    for (const payment of payments) {
      const date = localDate(payment.receivedAt, property.timezone);
      const byMethod = paymentsByDate.get(date) ?? new Map();
      byMethod.set(
        payment.method,
        (byMethod.get(payment.method) ?? new Prisma.Decimal(0)).plus(payment.amount),
      );
      paymentsByDate.set(date, byMethod);
    }

    let totalOpening = new Prisma.Decimal(0);
    let totalCashIn = new Prisma.Decimal(0);
    let totalCashOut = new Prisma.Decimal(0);
    let totalPayments = new Prisma.Decimal(0);
    let totalVariance = new Prisma.Decimal(0);
    let hasVariance = false;
    let openSessions = 0;
    const rows: Array<Record<string, string | number | null>> = [];

    for (let offset = 0; offset < calendarDayCount(filters.from, filters.to); offset += 1) {
      const date = addCalendarDays(filters.from, offset);
      const daySessions = sessions.filter(
        (session) => calendarDate(session.operationalDate) === date,
      );
      const dayPaymentMethods = paymentsByDate.get(date) ?? new Map<string, Prisma.Decimal>();
      const dayPayments = [...dayPaymentMethods.values()].reduce(
        (total, amount) => total.plus(amount),
        new Prisma.Decimal(0),
      );

      let opening = new Prisma.Decimal(0);
      let cashIn = new Prisma.Decimal(0);
      let cashOut = new Prisma.Decimal(0);
      let expected = new Prisma.Decimal(0);
      let closing = new Prisma.Decimal(0);
      let hasClosing = false;
      let variance = new Prisma.Decimal(0);
      let dayHasVariance = false;

      for (const session of daySessions) {
        const byType = movementBySession.get(session.id) ?? new Map<string, Prisma.Decimal>();
        const sessionCashIn = (byType.get('CASH_IN') ?? new Prisma.Decimal(0)).plus(
          byType.get('ADJUSTMENT') ?? new Prisma.Decimal(0),
        );
        const sessionCashOut = (byType.get('CASH_OUT') ?? new Prisma.Decimal(0)).plus(
          byType.get('REFUND') ?? new Prisma.Decimal(0),
        );
        const net = sessionCashIn.minus(sessionCashOut);
        const sessionExpected = session.expectedCashAmount ?? session.openingAmount.plus(net);

        opening = opening.plus(session.openingAmount);
        cashIn = cashIn.plus(sessionCashIn);
        cashOut = cashOut.plus(sessionCashOut);
        expected = expected.plus(sessionExpected);
        if (session.status === 'OPEN') {
          openSessions += 1;
        }
        if (session.closingAmount !== null) {
          hasClosing = true;
          closing = closing.plus(session.closingAmount);
        }
        if (session.closingAmount !== null && session.expectedCashAmount !== null) {
          dayHasVariance = true;
          variance = variance.plus(session.closingAmount.minus(session.expectedCashAmount));
        }
      }

      totalOpening = totalOpening.plus(opening);
      totalCashIn = totalCashIn.plus(cashIn);
      totalCashOut = totalCashOut.plus(cashOut);
      totalPayments = totalPayments.plus(dayPayments);
      if (dayHasVariance) {
        hasVariance = true;
        totalVariance = totalVariance.plus(variance);
      }

      const methods = [...dayPaymentMethods.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([method, amount]) => `${method}: ${money(amount)}`)
        .join(' · ');
      rows.push({
        date,
        session:
          daySessions.length === 0
            ? 'Sin caja'
            : daySessions.length === 1
              ? (daySessions[0]?.name ?? 'Caja')
              : `${daySessions.length} sesiones`,
        status:
          daySessions.length === 0
            ? 'Sin caja'
            : daySessions.some((session) => session.status === 'OPEN')
              ? 'Abierta'
              : 'Cerrada',
        opening: money(opening),
        cashIn: money(cashIn),
        cashOut: money(cashOut),
        expected: money(expected),
        closing: hasClosing ? money(closing) : '—',
        variance: dayHasVariance ? money(variance) : '—',
        paymentsTotal: money(dayPayments),
        paymentMethods: methods === '' ? '—' : methods,
      });
    }

    return {
      ...base,
      summary: [
        { key: 'opening', label: 'Caja inicial', value: money(totalOpening), format: 'currency' },
        {
          key: 'cashIn',
          label: 'Ingresos de efectivo',
          value: money(totalCashIn),
          format: 'currency',
        },
        {
          key: 'cashOut',
          label: 'Egresos de efectivo',
          value: money(totalCashOut),
          format: 'currency',
        },
        {
          key: 'netCash',
          label: 'Efectivo neto',
          value: money(totalCashIn.minus(totalCashOut)),
          format: 'currency',
        },
        {
          key: 'payments',
          label: 'Pagos registrados',
          value: money(totalPayments),
          format: 'currency',
        },
        { key: 'openSessions', label: 'Sesiones abiertas', value: openSessions, format: 'number' },
        ...(hasVariance
          ? [
              {
                key: 'variance',
                label: 'Diferencia de caja',
                value: money(totalVariance),
                format: 'currency' as const,
              },
            ]
          : []),
      ],
      rows,
    };
  }

  private reservationRow(
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

  private reservationCounts(
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
    const cancelled = reservations.filter(
      (reservation) => reservation.status === ReservationStatus.CANCELLED,
    ).length;
    const noShow = reservations.filter(
      (reservation) => reservation.status === ReservationStatus.NO_SHOW,
    ).length;
    const checkedIn = reservations.filter(
      (reservation) => reservation.status === ReservationStatus.CHECKED_IN,
    ).length;
    const checkedOut = reservations.filter(
      (reservation) => reservation.status === ReservationStatus.CHECKED_OUT,
    ).length;
    const confirmed = reservations.filter(
      (reservation) => reservation.status === ReservationStatus.CONFIRMED,
    ).length;
    const completed =
      mode === 'departure'
        ? reservations.filter(
            (reservation) =>
              reservation.stay?.checkedOutAt !== null &&
              reservation.stay?.checkedOutAt !== undefined,
          ).length
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

  private serialize(
    built: BuiltReport,
    executionId: string,
    page: number,
    pageSize: number,
    rows: Array<Record<string, string | number | null>>,
  ): ReportResult {
    const totalRows = built.rows.length;
    return {
      executionId,
      reportKey: built.definition.key,
      title: built.definition.title,
      description: built.definition.description,
      property: built.property,
      generatedAt: built.generatedAt.toISOString(),
      timezone: built.property.timezone,
      currencyCode: built.property.currencyCode,
      filters: built.filters,
      summary: built.summary,
      columns: built.definition.columns,
      rows,
      totalRows,
      page,
      pageSize,
      totalPages: totalRows === 0 ? 0 : Math.ceil(totalRows / pageSize),
    };
  }

  private toCsv(built: BuiltReport): string {
    const lines: string[] = [];
    const push = (cells: unknown[]): void => {
      lines.push(cells.map(csvCell).join(','));
    };

    push(['Reporte', built.definition.title]);
    push(['Propiedad', `${built.property.name} (${built.property.code})`]);
    push(['Desde', built.filters.from]);
    push(['Hasta', built.filters.to]);
    push(['Zona horaria', built.property.timezone]);
    push(['Generado', formatDateTime(built.generatedAt, built.property.timezone)]);
    lines.push('');
    push(['Resumen']);
    for (const item of built.summary) {
      push([item.label, item.value]);
    }
    lines.push('');
    push(built.definition.columns.map((column) => column.label));
    for (const row of built.rows) {
      push(built.definition.columns.map((column) => row[column.key] ?? ''));
    }
    return `\uFEFF${lines.join('\r\n')}\r\n`;
  }

  private assertWithinLimit(count: number): void {
    if (count > MAX_ROWS) {
      throw new BadRequestException({
        code: 'report_execution_limit_exceeded',
        message: `El reporte supera ${MAX_ROWS} filas. Acotá el período e intentá de nuevo.`,
      });
    }
  }
}

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

function calendarDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function localDate(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function formatDateTime(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(value);
}

function nights(checkInDate: Date, checkOutDate: Date): number {
  return Math.max(1, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 86_400_000));
}

function calendarDayCount(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }
  return Math.round((end - start) / 86_400_000) + 1;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
