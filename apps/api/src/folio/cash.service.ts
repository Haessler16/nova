import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CashMovementType, CashSessionStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { money, parseCalendarDate, parseMoney } from '../common/money/decimal';
import { Clock } from '../common/time/clock';
import { requirePropertyContext } from '../inventory/room-state.service';
import { computeOperationalDay } from '../operational-day/operational-day';
import { PrismaService } from '../prisma/prisma.service';
import {
  CloseCashSessionDto,
  ListCashSessionsQueryDto,
  OpenCashSessionDto,
  RecordCashMovementDto,
} from './dto/folio.dto';

const MOVEMENT_SELECT = Prisma.validator<Prisma.CashMovementSelect>()({
  id: true,
  cashSessionId: true,
  type: true,
  amount: true,
  currencyCode: true,
  description: true,
  recordedByUserId: true,
  createdAt: true,
});

const SESSION_SELECT = Prisma.validator<Prisma.CashSessionSelect>()({
  id: true,
  name: true,
  operationalDate: true,
  openingAmount: true,
  closingAmount: true,
  expectedCashAmount: true,
  status: true,
  currencyCode: true,
  openingByUserId: true,
  openedAt: true,
  closedAt: true,
  closedByUserId: true,
  createdAt: true,
  updatedAt: true,
  movements: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: MOVEMENT_SELECT },
});

type SessionRow = Prisma.CashSessionGetPayload<{ select: typeof SESSION_SELECT }>;
type MovementRow = Prisma.CashMovementGetPayload<{ select: typeof MOVEMENT_SELECT }>;
type Transaction = Prisma.TransactionClient;

export interface CashMovementResponse {
  id: string;
  type: CashMovementType;
  amount: string;
  currencyCode: string;
  description: string | null;
  recordedByUserId: string | null;
  createdAt: Date;
}

export interface CashSessionResponse {
  id: string;
  name: string;
  operationalDate: string;
  openingAmount: string;
  closingAmount: string | null;
  expectedCashAmount: string;
  status: CashSessionStatus;
  currencyCode: string;
  openingByUserId: string | null;
  openedAt: Date;
  closedAt: Date | null;
  closedByUserId: string | null;
  variance: string;
  movements: CashMovementResponse[];
  createdAt: Date;
  updatedAt: Date;
}

function movementDelta(type: CashMovementType, amount: Prisma.Decimal): Prisma.Decimal {
  switch (type) {
    case CashMovementType.CASH_IN:
    case CashMovementType.ADJUSTMENT:
      return amount;
    case CashMovementType.CASH_OUT:
    case CashMovementType.REFUND:
      return amount.negated();
    default:
      return new Prisma.Decimal(0);
  }
}

function expectedCash(row: Pick<SessionRow, 'openingAmount' | 'movements'>): Prisma.Decimal {
  return row.movements.reduce(
    (total, movement) => total.plus(movementDelta(movement.type, movement.amount)),
    row.openingAmount,
  );
}

function mapMovement(movement: MovementRow): CashMovementResponse {
  return {
    id: movement.id,
    type: movement.type,
    amount: money(movement.amount),
    currencyCode: movement.currencyCode,
    description: movement.description,
    recordedByUserId: movement.recordedByUserId,
    createdAt: movement.createdAt,
  };
}

function mapSession(row: SessionRow): CashSessionResponse {
  const expected = expectedCash(row);
  const closing = row.closingAmount ?? expected;
  return {
    id: row.id,
    name: row.name,
    operationalDate: row.operationalDate.toISOString().slice(0, 10),
    openingAmount: money(row.openingAmount),
    closingAmount: row.closingAmount === null ? null : money(row.closingAmount),
    expectedCashAmount: money(row.expectedCashAmount ?? expected),
    status: row.status,
    currencyCode: row.currencyCode,
    openingByUserId: row.openingByUserId,
    openedAt: row.openedAt,
    closedAt: row.closedAt,
    closedByUserId: row.closedByUserId,
    variance: money(closing.minus(row.expectedCashAmount ?? expected)),
    movements: row.movements.map(mapMovement),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class CashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  async list(
    context: TenantContext,
    query: ListCashSessionsQueryDto,
  ): Promise<{ items: CashSessionResponse[] }> {
    const propertyId = requirePropertyContext(context);
    const where: Prisma.CashSessionWhereInput = {
      organizationId: context.organizationId,
      propertyId,
    };
    if (query.status !== undefined) {
      where.status = query.status;
    }
    if (query.date !== undefined) {
      where.operationalDate = parseCalendarDate(query.date, 'date');
    }

    const rows = await this.prisma.cashSession.findMany({
      where,
      orderBy: [{ operationalDate: 'desc' }, { openedAt: 'desc' }],
      take: 100,
      select: SESSION_SELECT,
    });
    return { items: rows.map(mapSession) };
  }

  async get(context: TenantContext, sessionId: string): Promise<CashSessionResponse> {
    const propertyId = requirePropertyContext(context);
    const row = await this.prisma.cashSession.findFirst({
      where: { id: sessionId, organizationId: context.organizationId, propertyId },
      select: SESSION_SELECT,
    });
    if (row === null) {
      throw new NotFoundException({
        code: 'cash_session_not_found',
        message: 'Cash session not found.',
      });
    }
    return mapSession(row);
  }

  async open(context: TenantContext, dto: OpenCashSessionDto): Promise<CashSessionResponse> {
    const propertyId = requirePropertyContext(context);
    const openingAmount = parseMoney(dto.openingAmount, 'openingAmount', { allowZero: true });
    const operationalDate = parseCalendarDate(dto.operationalDate, 'operationalDate');

    const replay = await this.prisma.cashSession.findFirst({
      where: {
        organizationId: context.organizationId,
        propertyId,
        idempotencyKey: dto.idempotencyKey,
      },
      select: SESSION_SELECT,
    });
    if (replay !== null) {
      if (
        replay.name !== dto.name ||
        replay.operationalDate.toISOString().slice(0, 10) !== dto.operationalDate ||
        !replay.openingAmount.equals(openingAmount)
      ) {
        throw this.idempotencyReuse('cash session');
      }
      return mapSession(replay);
    }

    const property = await this.loadProperty(context.organizationId, propertyId);
    const current = computeOperationalDay(
      this.clock.now(),
      property.timezone,
      property.operationalDayStart,
    );
    if (dto.operationalDate > current.operationalDate) {
      throw new ConflictException({
        code: 'cash_session_future_date',
        message: 'A cash session cannot be opened for a future operational day.',
        details: { currentOperationalDate: current.operationalDate },
      });
    }

    const open = await this.prisma.cashSession.findFirst({
      where: {
        organizationId: context.organizationId,
        propertyId,
        status: CashSessionStatus.OPEN,
      },
      select: { id: true, name: true },
    });
    if (open !== null) {
      throw new ConflictException({
        code: 'cash_session_already_open',
        message: 'This property already has an open cash session.',
        details: { cashSessionId: open.id, name: open.name },
      });
    }

    let created: SessionRow;
    try {
      created = await this.prisma.$transaction(async (transaction) => {
        const session = await transaction.cashSession.create({
          data: {
            organizationId: context.organizationId,
            propertyId,
            name: dto.name,
            operationalDate,
            openingAmount,
            openingByUserId: context.actor.id,
            status: CashSessionStatus.OPEN,
            idempotencyKey: dto.idempotencyKey,
            currencyCode: property.currencyCode,
          },
          select: SESSION_SELECT,
        });

        await this.audit.append(
          {
            organizationId: context.organizationId,
            propertyId,
            actorUserId: context.actor.id,
            action: 'cash_session.opened',
            entityType: 'CashSession',
            entityId: session.id,
            correlationId: context.correlationId,
            metadata: {
              name: session.name,
              operationalDate: session.operationalDate.toISOString().slice(0, 10),
              openingAmount: money(session.openingAmount),
            },
          },
          transaction,
        );

        return session;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Either the partial unique index rejected a second open session or a
        // concurrent request with the same idempotency key won the race. Prisma
        // does not always expose the partial index name in `meta.target`, so
        // resolve both cases explicitly instead of leaking a 500.
        const replaySession = await this.prisma.cashSession.findFirst({
          where: {
            organizationId: context.organizationId,
            propertyId,
            idempotencyKey: dto.idempotencyKey,
          },
          select: SESSION_SELECT,
        });
        if (replaySession !== null) {
          return mapSession(replaySession);
        }
        throw new ConflictException({
          code: 'cash_session_already_open',
          message: 'This property already has an open cash session.',
        });
      }
      throw error;
    }

    return mapSession(created);
  }

  async recordMovement(
    context: TenantContext,
    sessionId: string,
    dto: RecordCashMovementDto,
  ): Promise<CashSessionResponse> {
    const propertyId = requirePropertyContext(context);
    const amount = parseMoney(dto.amount, 'amount');

    const replay = await this.prisma.cashMovement.findFirst({
      where: {
        organizationId: context.organizationId,
        propertyId,
        idempotencyKey: dto.idempotencyKey,
      },
      select: { id: true, cashSessionId: true, type: true, amount: true },
    });
    if (replay !== null) {
      if (
        replay.cashSessionId !== sessionId ||
        replay.type !== dto.type ||
        !replay.amount.equals(amount)
      ) {
        throw this.idempotencyReuse('cash movement');
      }
      return this.get(context, sessionId);
    }

    await this.prisma.$transaction(async (transaction) => {
      const session = await this.lockSession(
        transaction,
        context.organizationId,
        propertyId,
        sessionId,
      );
      if (session.status !== CashSessionStatus.OPEN) {
        throw new ConflictException({
          code: 'cash_session_closed',
          message: 'Movements cannot be recorded on a closed cash session.',
        });
      }

      const movement = await transaction.cashMovement.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          cashSessionId: sessionId,
          type: dto.type,
          amount,
          currencyCode: session.currencyCode,
          description: dto.description ?? null,
          idempotencyKey: dto.idempotencyKey,
          recordedByUserId: context.actor.id,
        },
        select: { id: true, type: true, amount: true },
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'cash_session.movement_recorded',
          entityType: 'CashMovement',
          entityId: movement.id,
          correlationId: context.correlationId,
          metadata: {
            cashSessionId: sessionId,
            type: movement.type,
            amount: money(movement.amount),
            description: dto.description ?? null,
          },
        },
        transaction,
      );
    });

    return this.get(context, sessionId);
  }

  async close(
    context: TenantContext,
    sessionId: string,
    dto: CloseCashSessionDto,
  ): Promise<CashSessionResponse> {
    const propertyId = requirePropertyContext(context);
    const closingAmount = parseMoney(dto.closingAmount, 'closingAmount', { allowZero: true });

    await this.prisma.$transaction(async (transaction) => {
      const session = await this.lockSession(
        transaction,
        context.organizationId,
        propertyId,
        sessionId,
      );

      if (session.status === CashSessionStatus.CLOSED) {
        const current = await transaction.cashSession.findFirst({
          where: { id: sessionId, organizationId: context.organizationId, propertyId },
          select: { closingAmount: true },
        });
        if (current?.closingAmount?.equals(closingAmount) === true) {
          return;
        }
        throw new ConflictException({
          code: 'cash_session_already_closed',
          message: 'This cash session was already closed with a different amount.',
        });
      }

      const row = await transaction.cashSession.findFirst({
        where: { id: sessionId, organizationId: context.organizationId, propertyId },
        select: SESSION_SELECT,
      });
      if (row === null) {
        throw new NotFoundException({
          code: 'cash_session_not_found',
          message: 'Cash session not found.',
        });
      }

      const expected = expectedCash(row);
      const variance = closingAmount.minus(expected);
      if (!variance.isZero() && (dto.varianceReason ?? '').trim().length < 3) {
        throw new BadRequestException({
          code: 'cash_variance_reason_required',
          message:
            'A variance reason is required when the counted cash differs from the expected amount.',
          details: {
            expectedCashAmount: money(expected),
            closingAmount: money(closingAmount),
            variance: money(variance),
          },
        });
      }

      await transaction.cashSession.update({
        where: { id: sessionId },
        data: {
          status: CashSessionStatus.CLOSED,
          closingAmount,
          expectedCashAmount: expected,
          closedAt: this.clock.now(),
          closedByUserId: context.actor.id,
        },
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'cash_session.closed',
          entityType: 'CashSession',
          entityId: sessionId,
          correlationId: context.correlationId,
          reason: dto.varianceReason ?? undefined,
          metadata: {
            expectedCashAmount: money(expected),
            closingAmount: money(closingAmount),
            variance: money(variance),
            notes: dto.notes ?? null,
            idempotencyKey: dto.idempotencyKey,
          },
        },
        transaction,
      );
    });

    return this.get(context, sessionId);
  }

  private async loadProperty(
    organizationId: string,
    propertyId: string,
  ): Promise<{ timezone: string; operationalDayStart: string; currencyCode: string }> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId },
      select: { timezone: true, operationalDayStart: true, currencyCode: true },
    });
    if (property === null) {
      throw new NotFoundException({
        code: 'property_not_found',
        message: 'Property not found in this organization.',
      });
    }
    return property;
  }

  private async lockSession(
    transaction: Transaction,
    organizationId: string,
    propertyId: string,
    sessionId: string,
  ): Promise<{ id: string; status: CashSessionStatus; currencyCode: string }> {
    const rows = await transaction.$queryRaw<
      Array<{ id: string; status: CashSessionStatus; currencyCode: string }>
    >`
      SELECT "id", "status", "currencyCode"
      FROM "CashSession"
      WHERE "organizationId" = ${organizationId}::uuid
        AND "propertyId" = ${propertyId}::uuid
        AND "id" = ${sessionId}::uuid
      FOR UPDATE
    `;
    const session = rows[0];
    if (session === undefined) {
      throw new NotFoundException({
        code: 'cash_session_not_found',
        message: 'Cash session not found.',
      });
    }
    return session;
  }

  private idempotencyReuse(scope: string): ConflictException {
    return new ConflictException({
      code: 'idempotency_key_reuse',
      message: `This idempotency key was already used with a different ${scope} payload.`,
    });
  }
}
