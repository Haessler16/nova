import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FolioLineStatus,
  OperationalCloseStatus,
  Prisma,
  ReservationStatus,
  StayStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { money, parseCalendarDate } from '../common/money/decimal';
import { Clock } from '../common/time/clock';
import { requirePropertyContext } from '../inventory/room-state.service';
import { computeOperationalDay } from '../operational-day/operational-day';
import { PrismaService } from '../prisma/prisma.service';
import {
  CloseOperationalDayDto,
  ListOperationalClosesQueryDto,
  ReopenOperationalDayDto,
} from './dto/night-audit.dto';

const OPERATIONAL_CLOSE_SELECT = Prisma.validator<Prisma.OperationalCloseSelect>()({
  id: true,
  operationalDate: true,
  status: true,
  snapshot: true,
  notes: true,
  closedByUserId: true,
  closedAt: true,
  reopenedByUserId: true,
  reopenedAt: true,
  reopenReason: true,
  createdAt: true,
  updatedAt: true,
});

type OperationalCloseRow = Prisma.OperationalCloseGetPayload<{
  select: typeof OPERATIONAL_CLOSE_SELECT;
}>;

export interface NightAuditBlocker {
  code: string;
  count: number;
  message: string;
}

export interface NightAuditSnapshot {
  generatedAt: string;
  operationalDate: string;
  timezone: string;
  operationalDayStart: string;
  currencyCode: string;
  counts: {
    openCashSessions: number;
    openFolios: number;
    confirmedArrivalsBeforeDate: number;
    inHousePastCheckout: number;
  };
  totals: {
    openFolioBalance: string;
  };
  blockers: NightAuditBlocker[];
  forced: boolean;
}

export interface OperationalCloseResponse {
  id: string;
  operationalDate: string;
  status: OperationalCloseStatus;
  snapshot: Prisma.JsonValue;
  notes: string | null;
  closedByUserId: string | null;
  closedAt: Date;
  reopenedByUserId: string | null;
  reopenedAt: Date | null;
  reopenReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapClose(row: OperationalCloseRow): OperationalCloseResponse {
  return {
    id: row.id,
    operationalDate: row.operationalDate.toISOString().slice(0, 10),
    status: row.status,
    snapshot: row.snapshot,
    notes: row.notes,
    closedByUserId: row.closedByUserId,
    closedAt: row.closedAt,
    reopenedByUserId: row.reopenedByUserId,
    reopenedAt: row.reopenedAt,
    reopenReason: row.reopenReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class NightAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  async list(
    context: TenantContext,
    query: ListOperationalClosesQueryDto,
  ): Promise<{ items: OperationalCloseResponse[] }> {
    const propertyId = requirePropertyContext(context);
    const where: Prisma.OperationalCloseWhereInput = {
      organizationId: context.organizationId,
      propertyId,
    };
    if (query.status !== undefined) {
      where.status = query.status;
    }
    if (query.date !== undefined) {
      where.operationalDate = parseCalendarDate(query.date, 'date');
    }

    const rows = await this.prisma.operationalClose.findMany({
      where,
      orderBy: [{ operationalDate: 'desc' }, { id: 'desc' }],
      take: 100,
      select: OPERATIONAL_CLOSE_SELECT,
    });
    return { items: rows.map(mapClose) };
  }

  async get(context: TenantContext, closeId: string): Promise<OperationalCloseResponse> {
    const propertyId = requirePropertyContext(context);
    const row = await this.prisma.operationalClose.findFirst({
      where: { id: closeId, organizationId: context.organizationId, propertyId },
      select: OPERATIONAL_CLOSE_SELECT,
    });
    if (row === null) {
      throw new NotFoundException({
        code: 'operational_close_not_found',
        message: 'Operational close not found.',
      });
    }
    return mapClose(row);
  }

  async close(
    context: TenantContext,
    dto: CloseOperationalDayDto,
  ): Promise<OperationalCloseResponse> {
    const propertyId = requirePropertyContext(context);
    const operationalDate = parseCalendarDate(dto.operationalDate, 'operationalDate');

    const replay = await this.prisma.operationalClose.findFirst({
      where: {
        organizationId: context.organizationId,
        propertyId,
        idempotencyKey: dto.idempotencyKey,
      },
      select: OPERATIONAL_CLOSE_SELECT,
    });
    if (replay !== null) {
      if (replay.operationalDate.toISOString().slice(0, 10) !== dto.operationalDate) {
        throw this.idempotencyReuse();
      }
      return mapClose(replay);
    }

    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId: context.organizationId },
      select: {
        timezone: true,
        operationalDayStart: true,
        currencyCode: true,
      },
    });
    if (property === null) {
      throw new NotFoundException({
        code: 'property_not_found',
        message: 'Property not found in this organization.',
      });
    }

    const current = computeOperationalDay(
      this.clock.now(),
      property.timezone,
      property.operationalDayStart,
    );
    if (dto.operationalDate > current.operationalDate) {
      throw new ConflictException({
        code: 'operational_day_in_future',
        message: 'The operational day cannot be closed before it starts.',
        details: { currentOperationalDate: current.operationalDate },
      });
    }

    const snapshot = await this.buildSnapshot(
      context.organizationId,
      propertyId,
      dto.operationalDate,
      {
        timezone: property.timezone,
        operationalDayStart: property.operationalDayStart,
        currencyCode: property.currencyCode,
      },
      dto.force === true,
    );

    if (snapshot.blockers.length > 0) {
      if (dto.force !== true) {
        throw new ConflictException({
          code: 'night_audit_blocked',
          message:
            'The operational day has unresolved items. Review the blockers or force the close with a reason.',
          details: { blockers: snapshot.blockers },
        });
      }
      if ((dto.forceReason ?? '').trim().length < 3) {
        throw new BadRequestException({
          code: 'force_reason_required',
          message: 'A reason is required when forcing the operational day close.',
        });
      }
    }

    const existing = await this.prisma.operationalClose.findFirst({
      where: {
        organizationId: context.organizationId,
        propertyId,
        operationalDate,
      },
      select: { id: true, status: true },
    });

    if (existing !== null && existing.status === OperationalCloseStatus.CLOSED) {
      throw new ConflictException({
        code: 'operational_day_already_closed',
        message: 'This operational day is already closed.',
        details: { operationalCloseId: existing.id },
      });
    }

    const closed = await this.prisma.$transaction(async (transaction) => {
      const row =
        existing !== null
          ? await transaction.operationalClose.update({
              where: { id: existing.id },
              data: {
                status: OperationalCloseStatus.CLOSED,
                idempotencyKey: dto.idempotencyKey,
                snapshot: snapshot as unknown as Prisma.InputJsonValue,
                notes: dto.notes ?? null,
                closedByUserId: context.actor.id,
                closedAt: this.clock.now(),
              },
              select: OPERATIONAL_CLOSE_SELECT,
            })
          : await transaction.operationalClose.create({
              data: {
                organizationId: context.organizationId,
                propertyId,
                operationalDate,
                status: OperationalCloseStatus.CLOSED,
                idempotencyKey: dto.idempotencyKey,
                snapshot: snapshot as unknown as Prisma.InputJsonValue,
                notes: dto.notes ?? null,
                closedByUserId: context.actor.id,
                closedAt: this.clock.now(),
              },
              select: OPERATIONAL_CLOSE_SELECT,
            });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'operational_day.closed',
          entityType: 'OperationalClose',
          entityId: row.id,
          correlationId: context.correlationId,
          reason: dto.force === true ? dto.forceReason : undefined,
          metadata: {
            operationalDate: dto.operationalDate,
            forced: snapshot.forced,
            blockers: snapshot.blockers,
            counts: snapshot.counts,
            totals: snapshot.totals,
          },
        },
        transaction,
      );

      return row;
    });

    return mapClose(closed);
  }

  async reopen(
    context: TenantContext,
    closeId: string,
    dto: ReopenOperationalDayDto,
  ): Promise<OperationalCloseResponse> {
    const propertyId = requirePropertyContext(context);

    const reopened = await this.prisma.$transaction(async (transaction) => {
      const row = await transaction.operationalClose.findFirst({
        where: { id: closeId, organizationId: context.organizationId, propertyId },
        select: { id: true, status: true, operationalDate: true },
      });
      if (row === null) {
        throw new NotFoundException({
          code: 'operational_close_not_found',
          message: 'Operational close not found.',
        });
      }
      if (row.status === OperationalCloseStatus.REOPENED) {
        const current = await transaction.operationalClose.findFirst({
          where: { id: closeId, organizationId: context.organizationId, propertyId },
          select: OPERATIONAL_CLOSE_SELECT,
        });
        if (current === null) {
          throw new NotFoundException({
            code: 'operational_close_not_found',
            message: 'Operational close not found.',
          });
        }
        return current;
      }

      const updated = await transaction.operationalClose.update({
        where: { id: closeId },
        data: {
          status: OperationalCloseStatus.REOPENED,
          reopenedByUserId: context.actor.id,
          reopenedAt: this.clock.now(),
          reopenReason: dto.reason,
        },
        select: OPERATIONAL_CLOSE_SELECT,
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'operational_day.reopened',
          entityType: 'OperationalClose',
          entityId: closeId,
          correlationId: context.correlationId,
          reason: dto.reason,
          metadata: {
            operationalDate: row.operationalDate.toISOString().slice(0, 10),
            idempotencyKey: dto.idempotencyKey,
          },
        },
        transaction,
      );

      return updated;
    });

    return mapClose(reopened);
  }

  private async buildSnapshot(
    organizationId: string,
    propertyId: string,
    operationalDate: string,
    property: { timezone: string; operationalDayStart: string; currencyCode: string },
    forced: boolean,
  ): Promise<NightAuditSnapshot> {
    const dateValue = parseCalendarDate(operationalDate, 'operationalDate');

    const [openCashSessions, openFolios, confirmedArrivals, inHousePastCheckout] =
      await Promise.all([
        this.prisma.cashSession.count({
          where: { organizationId, propertyId, status: 'OPEN' },
        }),
        this.prisma.folio.findMany({
          where: { organizationId, propertyId, status: 'OPEN' },
          select: {
            id: true,
            number: true,
            lines: {
              where: { status: FolioLineStatus.POSTED },
              select: { amount: true },
            },
            payments: {
              where: { status: 'COMPLETED' },
              select: { amount: true },
            },
          },
        }),
        this.prisma.reservation.count({
          where: {
            organizationId,
            propertyId,
            status: ReservationStatus.CONFIRMED,
            checkInDate: { lte: dateValue },
          },
        }),
        this.prisma.stay.count({
          where: {
            organizationId,
            propertyId,
            status: StayStatus.IN_HOUSE,
            reservation: { checkOutDate: { lte: dateValue } },
          },
        }),
      ]);

    const openBalance = openFolios.reduce((total, folio) => {
      const charges = folio.lines.reduce(
        (sum, line) => sum.plus(line.amount),
        new Prisma.Decimal(0),
      );
      const paid = folio.payments.reduce(
        (sum, payment) => sum.plus(payment.amount),
        new Prisma.Decimal(0),
      );
      return total.plus(charges.minus(paid));
    }, new Prisma.Decimal(0));

    const blockers: NightAuditBlocker[] = [];
    if (openCashSessions > 0) {
      blockers.push({
        code: 'open_cash_sessions',
        count: openCashSessions,
        message: 'Close all cash sessions before closing the operational day.',
      });
    }
    if (openFolios.length > 0) {
      blockers.push({
        code: 'open_folios',
        count: openFolios.length,
        message: 'Settle or cancel open folios before closing the operational day.',
      });
    }
    if (confirmedArrivals > 0) {
      blockers.push({
        code: 'confirmed_arrivals_pending',
        count: confirmedArrivals,
        message: 'Unresolved confirmed arrivals exist for this or earlier dates.',
      });
    }
    if (inHousePastCheckout > 0) {
      blockers.push({
        code: 'in_house_past_checkout',
        count: inHousePastCheckout,
        message: 'In-house stays are past their check-out date.',
      });
    }

    return {
      generatedAt: this.clock.now().toISOString(),
      operationalDate,
      timezone: property.timezone,
      operationalDayStart: property.operationalDayStart,
      currencyCode: property.currencyCode,
      counts: {
        openCashSessions,
        openFolios: openFolios.length,
        confirmedArrivalsBeforeDate: confirmedArrivals,
        inHousePastCheckout,
      },
      totals: { openFolioBalance: money(openBalance) },
      blockers,
      forced,
    };
  }

  private idempotencyReuse(): ConflictException {
    return new ConflictException({
      code: 'idempotency_key_reuse',
      message: 'This idempotency key was already used for a different operational close payload.',
    });
  }
}
