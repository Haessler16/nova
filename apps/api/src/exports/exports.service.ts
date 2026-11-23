import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FolioLineStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { money } from '../common/money/decimal';
import { Clock } from '../common/time/clock';
import {
  addCalendarDays,
  calendarDateInTimezone,
  propertyDayStart,
} from '../common/time/property-day';
import { requirePropertyContext } from '../inventory/room-state.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseCalendarDate } from '../reservations/reservation-dates';
import { toCsv } from './csv';
import {
  ExportFoliosQueryDto,
  ExportGuestsQueryDto,
  ExportReservationsQueryDto,
} from './dto/export.dto';

const EXPORT_MAX_ROWS = 5000;

export interface CsvExport {
  csv: string;
  rowCount: number;
}

/**
 * Read-only exports scoped to the authenticated property. Filters mirror the
 * list endpoints; exports never include another tenant's rows and every run is
 * audited with counts only (no personal data in the audit trail).
 */
@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  async guests(context: TenantContext, query: ExportGuestsQueryDto): Promise<CsvExport> {
    const propertyId = requirePropertyContext(context);
    const where: Prisma.GuestWhereInput = {
      organizationId: context.organizationId,
      propertyId,
      ...(query.status !== undefined ? { status: query.status } : {}),
    };

    if (query.search !== undefined && query.search.trim() !== '') {
      const search = query.search.trim();
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { documentNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.guest.findMany({
      where,
      take: EXPORT_MAX_ROWS + 1,
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      select: {
        fullName: true,
        email: true,
        phone: true,
        documentType: true,
        documentNumber: true,
        status: true,
        notes: true,
        createdAt: true,
      },
    });
    this.assertWithinLimit(rows.length);

    const csv = toCsv(
      [
        'fullName',
        'email',
        'phone',
        'documentType',
        'documentNumber',
        'status',
        'notes',
        'createdAt',
      ],
      rows.map((row) => [
        row.fullName,
        row.email,
        row.phone,
        row.documentType,
        row.documentNumber,
        row.status,
        row.notes,
        row.createdAt,
      ]),
    );

    await this.recordExport(context, 'export.guests', rows.length);
    return { csv, rowCount: rows.length };
  }

  async reservations(
    context: TenantContext,
    query: ExportReservationsQueryDto,
  ): Promise<CsvExport> {
    const propertyId = requirePropertyContext(context);
    const where: Prisma.ReservationWhereInput = {
      organizationId: context.organizationId,
      propertyId,
      ...(query.status !== undefined ? { status: query.status } : {}),
    };

    if (query.fromDate !== undefined || query.toDate !== undefined) {
      const from =
        query.fromDate !== undefined ? parseCalendarDate(query.fromDate, 'fromDate') : undefined;
      const to = query.toDate !== undefined ? parseCalendarDate(query.toDate, 'toDate') : undefined;
      if (from !== undefined && to !== undefined && to.getTime() <= from.getTime()) {
        throw new BadRequestException({
          code: 'invalid_date_filter',
          message: 'toDate must be after fromDate.',
        });
      }
      where.AND = [
        ...(from !== undefined ? [{ checkOutDate: { gt: from } }] : []),
        ...(to !== undefined ? [{ checkInDate: { lt: to } }] : []),
      ];
    }

    if (query.search !== undefined && query.search.trim() !== '') {
      const search = query.search.trim();
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { guest: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.reservation.findMany({
      where,
      take: EXPORT_MAX_ROWS + 1,
      orderBy: [{ checkInDate: 'asc' }, { id: 'asc' }],
      select: {
        code: true,
        status: true,
        checkInDate: true,
        checkOutDate: true,
        adults: true,
        children: true,
        source: true,
        createdAt: true,
        guest: { select: { fullName: true, email: true } },
        roomType: { select: { code: true, name: true } },
        room: { select: { number: true } },
      },
    });
    this.assertWithinLimit(rows.length);

    const csv = toCsv(
      [
        'code',
        'status',
        'checkInDate',
        'checkOutDate',
        'nights',
        'adults',
        'children',
        'guestName',
        'guestEmail',
        'roomTypeCode',
        'roomTypeName',
        'roomNumber',
        'source',
        'createdAt',
      ],
      rows.map((row) => [
        row.code,
        row.status,
        calendarDate(row.checkInDate),
        calendarDate(row.checkOutDate),
        Math.round((row.checkOutDate.getTime() - row.checkInDate.getTime()) / 86_400_000),
        row.adults,
        row.children,
        row.guest.fullName,
        row.guest.email,
        row.roomType.code,
        row.roomType.name,
        row.room?.number ?? null,
        row.source,
        row.createdAt,
      ]),
    );

    await this.recordExport(context, 'export.reservations', rows.length);
    return { csv, rowCount: rows.length };
  }

  async folios(context: TenantContext, query: ExportFoliosQueryDto): Promise<CsvExport> {
    const propertyId = requirePropertyContext(context);
    const where: Prisma.FolioWhereInput = {
      organizationId: context.organizationId,
      propertyId,
    };

    if (query.status !== undefined) {
      where.status = query.status;
    }
    if (query.search !== undefined && query.search.trim() !== '') {
      const search = query.search.trim();
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { reservation: { code: { contains: search, mode: 'insensitive' } } },
        { reservation: { guest: { fullName: { contains: search, mode: 'insensitive' } } } },
        { stay: { guest: { fullName: { contains: search, mode: 'insensitive' } } } },
      ];
    }
    if (query.date !== undefined) {
      const property = await this.prisma.property.findFirst({
        where: { id: propertyId, organizationId: context.organizationId },
        select: { timezone: true },
      });
      if (property === null) {
        throw new NotFoundException({
          code: 'property_not_found',
          message: 'Property not found in the current organization.',
        });
      }

      where.createdAt = {
        gte: propertyDayStart(query.date, property.timezone),
        lt: propertyDayStart(addCalendarDays(query.date, 1), property.timezone),
      };
    }

    const rows = await this.prisma.folio.findMany({
      where,
      take: EXPORT_MAX_ROWS + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        number: true,
        status: true,
        currencyCode: true,
        createdAt: true,
        closedAt: true,
        reservation: {
          select: { code: true, guest: { select: { fullName: true } } },
        },
        stay: { select: { guest: { select: { fullName: true } } } },
        lines: { select: { amount: true, status: true } },
        payments: { select: { amount: true, status: true } },
      },
    });
    this.assertWithinLimit(rows.length);

    const csv = toCsv(
      [
        'number',
        'status',
        'reservationCode',
        'guestName',
        'currencyCode',
        'charges',
        'payments',
        'balance',
        'createdAt',
        'closedAt',
      ],
      rows.map((row) => {
        const charges = row.lines
          .filter((line) => line.status === FolioLineStatus.POSTED)
          .reduce((total, line) => total.plus(line.amount), new Prisma.Decimal(0));
        const paid = row.payments
          .filter((payment) => payment.status === 'COMPLETED')
          .reduce((total, payment) => total.plus(payment.amount), new Prisma.Decimal(0));

        return [
          row.number,
          row.status,
          row.reservation?.code ?? null,
          row.stay?.guest.fullName ?? row.reservation?.guest.fullName ?? null,
          row.currencyCode,
          money(charges),
          money(paid),
          money(charges.minus(paid)),
          row.createdAt,
          row.closedAt,
        ];
      }),
    );

    await this.recordExport(context, 'export.folios', rows.length);
    return { csv, rowCount: rows.length };
  }

  private assertWithinLimit(count: number): void {
    if (count > EXPORT_MAX_ROWS) {
      throw new BadRequestException({
        code: 'export_too_large',
        message: `La exportación supera ${EXPORT_MAX_ROWS} filas. Acotá los filtros e intentá de nuevo.`,
      });
    }
  }

  private async recordExport(
    context: TenantContext,
    action: 'export.guests' | 'export.reservations' | 'export.folios',
    rowCount: number,
  ): Promise<void> {
    await this.audit.append({
      organizationId: context.organizationId,
      propertyId: requirePropertyContext(context),
      actorUserId: context.actor.id,
      action,
      entityType: 'Export',
      entityId: randomUUID(),
      correlationId: context.correlationId,
      metadata: { rowCount },
    });
  }

  /** Property-local date used in the downloaded file name. */
  async filenameDate(context: TenantContext): Promise<string> {
    const propertyId = requirePropertyContext(context);
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId: context.organizationId },
      select: { timezone: true },
    });
    if (property === null) {
      throw new NotFoundException({
        code: 'property_not_found',
        message: 'Property not found in the current organization.',
      });
    }
    return calendarDateInTimezone(this.clock.now(), property.timezone);
  }
}

function calendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
