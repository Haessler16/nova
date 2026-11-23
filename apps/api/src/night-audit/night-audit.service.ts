import { Injectable, NotFoundException } from '@nestjs/common';
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
import { PrismaService } from '../prisma/prisma.service';
import {
  CloseOperationalDayDto,
  ListOperationalClosesQueryDto,
  ReopenOperationalDayDto,
} from './dto/night-audit.dto';
import {
  assertOperationalDateCloseable,
  assertSnapshotCloseable,
  findCloseReplay,
  findExistingClose,
  loadCloseProperty,
  writeOperationalClose,
} from './night-audit.close';
import {
  OPERATIONAL_CLOSE_SELECT,
  mapClose,
  type NightAuditBlocker,
  type NightAuditSnapshot,
  type OperationalCloseResponse,
} from './night-audit.contracts';

export type {
  NightAuditBlocker,
  NightAuditSnapshot,
  OperationalCloseResponse,
} from './night-audit.contracts';

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

    const replay = await findCloseReplay(
      this.prisma,
      context.organizationId,
      propertyId,
      dto,
    );
    if (replay !== null) {
      return mapClose(replay);
    }

    const property = await loadCloseProperty(this.prisma, context.organizationId, propertyId);
    assertOperationalDateCloseable(dto.operationalDate, property, this.clock.now());

    const snapshot = await this.buildSnapshot(
      context.organizationId,
      propertyId,
      dto.operationalDate,
      property,
      dto.force === true,
    );
    assertSnapshotCloseable(snapshot, dto);

    const existing = await findExistingClose(
      this.prisma,
      context.organizationId,
      propertyId,
      operationalDate,
    );

    const closed = await writeOperationalClose(
      { prisma: this.prisma, audit: this.audit, closedAt: this.clock.now() },
      { context, propertyId, operationalDate, snapshot, dto },
      existing,
    );

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

}
