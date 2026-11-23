import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FolioStatus,
  HousekeepingState,
  Prisma,
  ReservationStatus,
  StayStatus,
} from '@prisma/client';
import { PERMISSIONS } from '../../access/permissions';
import { AuditService } from '../../audit/audit.service';
import { TenantContext } from '../../common/http/request-context';
import { money } from '../../common/money/decimal';
import { Clock } from '../../common/time/clock';
import { computeFolioTotals, type FolioTotals } from '../../folio/folio-totals';
import { requirePropertyContext } from '../../inventory/room-state.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckOutDto } from '../dto/front-office.dto';
import { lockStayRow } from '../infrastructure/row-locks';
import {
  mapStay,
  STAY_SELECT,
  type CheckOutResponse,
  type CheckoutReadiness,
  type CheckoutSummary,
  type StayRow,
  type Transaction,
} from './front-office.contracts';

interface FolioCheckoutRow {
  id: string;
  number: string;
  status: FolioStatus;
  currencyCode: string;
  totals: FolioTotals;
}

@Injectable()
export class CheckOutUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  /** Read-only checkout checklist for the guided front-desk flow. */
  async readiness(context: TenantContext, stayId: string): Promise<CheckoutReadiness> {
    const propertyId = requirePropertyContext(context);
    const stay = await this.prisma.stay.findFirst({
      where: { id: stayId, organizationId: context.organizationId, propertyId },
      select: STAY_SELECT,
    });
    if (stay === null) {
      throw new NotFoundException({
        code: 'stay_not_found',
        message: 'Stay not found in the selected property.',
      });
    }

    const folios = await readCheckoutFolios(this.prisma, context.organizationId, propertyId, stay);
    const room = await this.prisma.room.findFirst({
      where: { id: stay.roomId, organizationId: context.organizationId, propertyId },
      select: { housekeepingState: true },
    });
    const housekeeping = room?.housekeepingState ?? HousekeepingState.DIRTY;
    const summary = buildCheckoutSummary(folios, {
      from: housekeeping,
      to: HousekeepingState.DIRTY,
    });

    const outstanding = folios.filter(
      (folio) => folio.status === FolioStatus.OPEN && !folio.totals.balance.isZero(),
    );
    const openFolios = folios.filter((folio) => folio.status === FolioStatus.OPEN);

    const blockedReasons: Array<{ code: string; message: string }> = [];
    if (stay.status !== StayStatus.IN_HOUSE) {
      blockedReasons.push({
        code: 'stay_not_in_house',
        message: 'Only in-house stays can be checked out.',
      });
    }

    const warnings: Array<{ code: string; message: string }> = [];
    if (outstanding.length > 0) {
      warnings.push({
        code: 'folio_balance_outstanding',
        message:
          'The account has an outstanding balance. Settle it or authorize checkout with a balance.',
      });
    }
    if (folios.length === 0) {
      warnings.push({
        code: 'no_folio',
        message: 'This stay has no account. Checkout only releases the room.',
      });
    }
    if (openFolios.length > 1) {
      warnings.push({
        code: 'multiple_open_folios',
        message: 'More than one open account will be closed at checkout.',
      });
    }

    return {
      stay: {
        id: stay.id,
        status: stay.status,
        room: { id: stay.room.id, number: stay.room.number },
        guest: { id: stay.guest.id, fullName: stay.guest.fullName },
        reservation: { id: stay.reservation.id, code: stay.reservation.code },
      },
      folios: summary.folios,
      totals: summary.totals,
      housekeeping: { current: housekeeping, target: HousekeepingState.DIRTY },
      blockedReasons,
      warnings,
      canCheckOut: blockedReasons.length === 0,
    };
  }

  async execute(
    context: TenantContext,
    stayId: string,
    dto: CheckOutDto,
  ): Promise<CheckOutResponse> {
    const propertyId = requirePropertyContext(context);

    return this.prisma.$transaction(async (transaction) => {
      const stay = await lockStayRow(transaction, {
        organizationId: context.organizationId,
        propertyId,
        id: stayId,
      });
      const folios = await readCheckoutFolios(
        transaction,
        context.organizationId,
        propertyId,
        stay,
      );
      const room = await transaction.room.findFirst({
        where: { id: stay.roomId, organizationId: context.organizationId, propertyId },
        select: { id: true, number: true, housekeepingState: true },
      });

      if (stay.status === StayStatus.CHECKED_OUT) {
        const housekeeping = room?.housekeepingState ?? HousekeepingState.DIRTY;
        return {
          ...mapStay(stay),
          checkout: buildCheckoutSummary(folios, { from: housekeeping, to: housekeeping }),
        };
      }

      const { closeFolios, openFolios, balanceReason } = this.assertClosable(
        context,
        stay,
        folios,
        dto,
      );

      const now = this.clock.now();

      if (closeFolios) {
        await this.closeFolios(
          transaction,
          context,
          propertyId,
          stay.id,
          openFolios,
          balanceReason,
          now,
        );
      }

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

      // Occupancy is released by the stay status; housekeeping is a separate
      // dimension and normally becomes DIRTY after a departure.
      const fromHousekeeping = room?.housekeepingState ?? HousekeepingState.DIRTY;
      await this.releaseRoom(transaction, context, propertyId, room, fromHousekeeping);

      const summaryFolios = folios.map((folio) =>
        closeFolios && folio.status === FolioStatus.OPEN
          ? { ...folio, status: FolioStatus.SETTLED }
          : folio,
      );
      const checkout = buildCheckoutSummary(summaryFolios, {
        from: fromHousekeeping,
        to: HousekeepingState.DIRTY,
      });

      await this.appendCheckOutAudit(
        transaction,
        context,
        propertyId,
        stay,
        checkout,
        closeFolios ? openFolios.length : 0,
        folios,
      );

      return { ...mapStay(updated), checkout };
    });
  }

  /**
   * Checkout closes the account by default, so an ineligible stay, a missing
   * permission or an outstanding balance is rejected before anything is written.
   */
  private assertClosable(
    context: TenantContext,
    stay: StayRow,
    folios: readonly FolioCheckoutRow[],
    dto: CheckOutDto,
  ): { closeFolios: boolean; openFolios: FolioCheckoutRow[]; balanceReason: string } {
    if (stay.status !== StayStatus.IN_HOUSE) {
      throw new ConflictException({
        code: 'stay_not_check_out_eligible',
        message: 'Only in-house stays can be checked out.',
        details: { status: stay.status },
      });
    }

    const closeFolios = dto.closeFolios ?? true;
    if (closeFolios && !context.permissions.has(PERMISSIONS.FOLIO_MANAGE)) {
      throw new ForbiddenException({
        code: 'permission_denied',
        message: 'Closing the account at checkout requires folio.manage.',
      });
    }

    const balanceReason = (dto.balanceReason ?? '').trim();
    const openFolios = folios.filter((folio) => folio.status === FolioStatus.OPEN);
    const outstanding = openFolios.filter((folio) => !folio.totals.balance.isZero());

    if (closeFolios && outstanding.length > 0) {
      if (!dto.allowOutstandingBalance) {
        throw new ConflictException({
          code: 'folio_balance_outstanding',
          message:
            'The account still has an outstanding balance. Settle it or authorize checkout with a balance.',
          details: {
            folios: outstanding.map((folio) => ({
              id: folio.id,
              number: folio.number,
              balance: money(folio.totals.balance),
              currencyCode: folio.currencyCode,
            })),
          },
        });
      }
      if (balanceReason.length < 3) {
        throw new BadRequestException({
          code: 'balance_reason_required',
          message: 'A reason with at least 3 characters is required to check out with a balance.',
        });
      }
    }

    return { closeFolios, openFolios, balanceReason };
  }

  private async closeFolios(
    transaction: Transaction,
    context: TenantContext,
    propertyId: string,
    stayId: string,
    openFolios: readonly FolioCheckoutRow[],
    balanceReason: string,
    now: Date,
  ): Promise<void> {
    for (const folio of openFolios) {
      await transaction.folio.update({
        where: { id: folio.id },
        data: { status: FolioStatus.SETTLED, closedAt: now },
      });
      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'folio.closed_at_checkout',
          entityType: 'Folio',
          entityId: folio.id,
          correlationId: context.correlationId,
          reason: folio.totals.balance.isZero() ? undefined : balanceReason,
          metadata: {
            number: folio.number,
            stayId,
            charges: money(folio.totals.charges),
            payments: money(folio.totals.payments),
            balance: money(folio.totals.balance),
            currencyCode: folio.currencyCode,
          },
        },
        transaction,
      );
    }
  }

  private async releaseRoom(
    transaction: Transaction,
    context: TenantContext,
    propertyId: string,
    room: { id: string; number: string } | null,
    fromHousekeeping: HousekeepingState,
  ): Promise<void> {
    if (room === null || fromHousekeeping === HousekeepingState.DIRTY) {
      return;
    }
    await transaction.room.update({
      where: { id: room.id },
      data: {
        housekeepingState: HousekeepingState.DIRTY,
        updatedByUserId: context.actor.id,
      },
    });
    await transaction.roomStatusHistory.create({
      data: {
        organizationId: context.organizationId,
        propertyId,
        roomId: room.id,
        category: 'HOUSEKEEPING',
        fromState: fromHousekeeping,
        toState: HousekeepingState.DIRTY,
        reason: 'Checkout.',
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
        entityId: room.id,
        correlationId: context.correlationId,
        reason: 'Checkout.',
        metadata: {
          roomNumber: room.number,
          from: fromHousekeeping,
          to: HousekeepingState.DIRTY,
        },
      },
      transaction,
    );
  }

  private async appendCheckOutAudit(
    transaction: Transaction,
    context: TenantContext,
    propertyId: string,
    stay: { id: string; roomId: string; reservationId: string; reservation: { code: string } },
    checkout: CheckoutSummary,
    foliosClosed: number,
    folios: readonly FolioCheckoutRow[],
  ): Promise<void> {
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
          foliosClosed,
          outstandingBalance: checkout.outstandingBalance,
          balance: checkout.totals.balance,
          currencyCode: folios[0]?.currencyCode ?? null,
        },
      },
      transaction,
    );
  }
}

async function readCheckoutFolios(
  client: Pick<Prisma.TransactionClient, 'folio'>,
  organizationId: string,
  propertyId: string,
  stay: { id: string; reservationId: string },
): Promise<FolioCheckoutRow[]> {
  const rows = await client.folio.findMany({
    where: {
      organizationId,
      propertyId,
      status: { not: FolioStatus.CANCELLED },
      OR: [{ stayId: stay.id }, { reservationId: stay.reservationId }],
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      number: true,
      status: true,
      currencyCode: true,
      lines: { select: { amount: true, status: true } },
      payments: { select: { amount: true, status: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    status: row.status,
    currencyCode: row.currencyCode,
    totals: computeFolioTotals(row.lines, row.payments),
  }));
}

function buildCheckoutSummary(
  folios: readonly FolioCheckoutRow[],
  housekeeping: { from: HousekeepingState; to: HousekeepingState },
): CheckoutSummary {
  const totals = folios.reduce(
    (acc, folio) => ({
      charges: acc.charges.plus(folio.totals.charges),
      payments: acc.payments.plus(folio.totals.payments),
      balance: acc.balance.plus(folio.totals.balance),
    }),
    {
      charges: new Prisma.Decimal(0),
      payments: new Prisma.Decimal(0),
      balance: new Prisma.Decimal(0),
    },
  );

  return {
    folios: folios.map((folio) => ({
      id: folio.id,
      number: folio.number,
      status: folio.status,
      currencyCode: folio.currencyCode,
      charges: money(folio.totals.charges),
      payments: money(folio.totals.payments),
      balance: money(folio.totals.balance),
    })),
    totals: {
      charges: money(totals.charges),
      payments: money(totals.payments),
      balance: money(totals.balance),
    },
    housekeeping,
    outstandingBalance: !totals.balance.isZero(),
  };
}
