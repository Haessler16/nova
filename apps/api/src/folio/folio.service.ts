import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FolioLineSource,
  FolioLineStatus,
  FolioProductCategory,
  FolioStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { computeFolioTotals } from './folio-totals';
import { TenantContext } from '../common/http/request-context';
import { money, parseMoney } from '../common/money/decimal';
import {
  addCalendarDays,
  calendarDateInTimezone,
  propertyDayStart,
} from '../common/time/property-day';
import { requirePropertyContext } from '../inventory/room-state.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddFolioChargeDto,
  CancelFolioDto,
  CreateFolioDto,
  ListFoliosQueryDto,
  RecordPaymentDto,
  VoidFolioChargeDto,
} from './dto/folio.dto';

const LINE_SELECT = Prisma.validator<Prisma.FolioLineSelect>()({
  id: true,
  folioId: true,
  description: true,
  amount: true,
  currencyCode: true,
  status: true,
  postedAt: true,
  voidedAt: true,
  voidReason: true,
  productId: true,
  quantity: true,
  unitAmount: true,
  unit: true,
  source: true,
  createdByUserId: true,
  createdAt: true,
});

/** Default provenance for a catalog consumption, derived from its category. */
const CATEGORY_SOURCE: Record<FolioProductCategory, FolioLineSource> = {
  MINIBAR: FolioLineSource.MINIBAR,
  FOOD_BEVERAGE: FolioLineSource.FRONT_DESK,
  PARKING: FolioLineSource.PARKING,
  LAUNDRY: FolioLineSource.SERVICE,
  SERVICE: FolioLineSource.SERVICE,
  OTHER: FolioLineSource.FRONT_DESK,
};

const PAYMENT_SELECT = Prisma.validator<Prisma.PaymentSelect>()({
  id: true,
  folioId: true,
  amount: true,
  currencyCode: true,
  method: true,
  status: true,
  referenceId: true,
  description: true,
  receivedByUserId: true,
  receivedAt: true,
  createdAt: true,
});

const FOLIO_SELECT = Prisma.validator<Prisma.FolioSelect>()({
  id: true,
  number: true,
  status: true,
  currencyCode: true,
  stayId: true,
  reservationId: true,
  notes: true,
  openedByUserId: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  lines: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: LINE_SELECT },
  payments: { orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }], select: PAYMENT_SELECT },
});

type FolioRow = Prisma.FolioGetPayload<{ select: typeof FOLIO_SELECT }>;
type LineRow = Prisma.FolioLineGetPayload<{ select: typeof LINE_SELECT }>;
type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof PAYMENT_SELECT }>;
type Transaction = Prisma.TransactionClient;

export interface FolioLineResponse {
  id: string;
  description: string;
  amount: string;
  currencyCode: string;
  status: FolioLineStatus;
  postedAt: Date;
  voidedAt: Date | null;
  voidReason: string | null;
  productId: string | null;
  quantity: string;
  unitAmount: string | null;
  unit: string | null;
  source: FolioLineSource;
  createdByUserId: string | null;
}

export interface PaymentResponse {
  id: string;
  amount: string;
  currencyCode: string;
  method: string;
  status: string;
  referenceId: string | null;
  description: string | null;
  receivedByUserId: string | null;
  receivedAt: Date;
}

export interface FolioResponse {
  id: string;
  number: string;
  status: FolioStatus;
  currencyCode: string;
  stayId: string | null;
  reservationId: string | null;
  notes: string | null;
  openedByUserId: string | null;
  closedAt: Date | null;
  totals: { charges: string; payments: string; balance: string };
  lines: FolioLineResponse[];
  payments: PaymentResponse[];
  createdAt: Date;
  updatedAt: Date;
}

interface FolioTotals {
  charges: Prisma.Decimal;
  payments: Prisma.Decimal;
  balance: Prisma.Decimal;
}

function computeTotals(lines: readonly LineRow[], payments: readonly PaymentRow[]): FolioTotals {
  return computeFolioTotals(lines, payments);
}

function mapLine(line: LineRow): FolioLineResponse {
  return {
    id: line.id,
    description: line.description,
    amount: money(line.amount),
    currencyCode: line.currencyCode,
    status: line.status,
    postedAt: line.postedAt,
    voidedAt: line.voidedAt,
    voidReason: line.voidReason,
    productId: line.productId,
    quantity: line.quantity.toFixed(2),
    unitAmount: line.unitAmount === null ? null : money(line.unitAmount),
    unit: line.unit,
    source: line.source,
    createdByUserId: line.createdByUserId,
  };
}

function mapPayment(payment: PaymentRow): PaymentResponse {
  return {
    id: payment.id,
    amount: money(payment.amount),
    currencyCode: payment.currencyCode,
    method: payment.method,
    status: payment.status,
    referenceId: payment.referenceId,
    description: payment.description,
    receivedByUserId: payment.receivedByUserId,
    receivedAt: payment.receivedAt,
  };
}

function mapFolio(folio: FolioRow): FolioResponse {
  const totals = computeTotals(folio.lines, folio.payments);
  return {
    id: folio.id,
    number: folio.number,
    status: folio.status,
    currencyCode: folio.currencyCode,
    stayId: folio.stayId,
    reservationId: folio.reservationId,
    notes: folio.notes,
    openedByUserId: folio.openedByUserId,
    closedAt: folio.closedAt,
    totals: {
      charges: money(totals.charges),
      payments: money(totals.payments),
      balance: money(totals.balance),
    },
    lines: folio.lines.map(mapLine),
    payments: folio.payments.map(mapPayment),
    createdAt: folio.createdAt,
    updatedAt: folio.updatedAt,
  };
}

@Injectable()
export class FolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    context: TenantContext,
    query: ListFoliosQueryDto,
  ): Promise<{ items: FolioResponse[] }> {
    const propertyId = requirePropertyContext(context);

    const where: Prisma.FolioWhereInput = {
      organizationId: context.organizationId,
      propertyId,
    };
    if (query.status !== undefined) {
      where.status = query.status;
    }
    if (query.stayId !== undefined) {
      where.stayId = query.stayId;
    }
    if (query.reservationId !== undefined) {
      where.reservationId = query.reservationId;
    }
    if (query.search !== undefined && query.search.trim() !== '') {
      const search = query.search.trim();
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { reservation: { code: { contains: search, mode: 'insensitive' } } },
        { reservation: { guest: { fullName: { contains: search, mode: 'insensitive' } } } },
        { stay: { guest: { fullName: { contains: search, mode: 'insensitive' } } } },
        { stay: { room: { number: { contains: search, mode: 'insensitive' } } } },
        { reservation: { room: { number: { contains: search, mode: 'insensitive' } } } },
      ];
    }
    if (query.date !== undefined) {
      const property = await this.loadProperty(context.organizationId, propertyId);
      where.createdAt = {
        gte: propertyDayStart(query.date, property.timezone),
        lt: propertyDayStart(addCalendarDays(query.date, 1), property.timezone),
      };
    }

    const rows = await this.prisma.folio.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: FOLIO_SELECT,
    });

    return { items: rows.map(mapFolio) };
  }

  async get(context: TenantContext, folioId: string): Promise<FolioResponse> {
    const propertyId = requirePropertyContext(context);
    const folio = await this.prisma.folio.findFirst({
      where: { id: folioId, organizationId: context.organizationId, propertyId },
      select: FOLIO_SELECT,
    });
    if (folio === null) {
      throw new NotFoundException({ code: 'folio_not_found', message: 'Folio not found.' });
    }
    return mapFolio(folio);
  }

  async create(context: TenantContext, dto: CreateFolioDto): Promise<FolioResponse> {
    const propertyId = requirePropertyContext(context);
    const property = await this.loadProperty(context.organizationId, propertyId);

    const existing = await this.prisma.folio.findFirst({
      where: {
        organizationId: context.organizationId,
        propertyId,
        idempotencyKey: dto.idempotencyKey,
      },
      select: FOLIO_SELECT,
    });
    if (existing !== null) {
      if (
        existing.stayId !== (dto.stayId ?? null) ||
        existing.reservationId !== (dto.reservationId ?? null)
      ) {
        throw this.idempotencyReuse('folio');
      }
      return mapFolio(existing);
    }

    let created: FolioRow;
    try {
      created = await this.prisma.$transaction(async (transaction) => {
        const link = await this.resolveLink(transaction, {
          organizationId: context.organizationId,
          propertyId,
          stayId: dto.stayId,
          reservationId: dto.reservationId,
        });

        const active = await transaction.folio.findFirst({
          where: {
            organizationId: context.organizationId,
            propertyId,
            status: { not: FolioStatus.CANCELLED },
            OR: [
              ...(link.stayId !== null ? [{ stayId: link.stayId }] : []),
              ...(link.reservationId !== null ? [{ reservationId: link.reservationId }] : []),
            ],
          },
          select: { id: true, number: true },
        });
        if (active !== null) {
          throw new ConflictException({
            code: 'folio_already_exists',
            message: 'An active folio already exists for this stay or reservation.',
            details: { folioId: active.id, number: active.number },
          });
        }

        const folio = await transaction.folio.create({
          data: {
            organizationId: context.organizationId,
            propertyId,
            stayId: link.stayId,
            reservationId: link.reservationId,
            number: this.generateNumber(property.timezone),
            status: FolioStatus.OPEN,
            currencyCode: property.currencyCode,
            notes: dto.notes ?? null,
            idempotencyKey: dto.idempotencyKey,
            openedByUserId: context.actor.id,
          },
          select: FOLIO_SELECT,
        });

        await this.audit.append(
          {
            organizationId: context.organizationId,
            propertyId,
            actorUserId: context.actor.id,
            action: 'folio.opened',
            entityType: 'Folio',
            entityId: folio.id,
            correlationId: context.correlationId,
            metadata: {
              number: folio.number,
              stayId: folio.stayId,
              reservationId: folio.reservationId,
              currencyCode: folio.currencyCode,
            },
          },
          transaction,
        );

        return folio;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'folio_already_exists',
          message: 'An active folio already exists for this stay or reservation.',
        });
      }
      throw error;
    }

    return mapFolio(created);
  }

  async addCharge(
    context: TenantContext,
    folioId: string,
    dto: AddFolioChargeDto,
  ): Promise<FolioResponse> {
    const propertyId = requirePropertyContext(context);
    const productId = dto.productId ?? null;
    const quantity =
      dto.quantity === undefined ? new Prisma.Decimal(1) : this.parseQuantity(dto.quantity);

    if (productId === null && (dto.description === undefined || dto.amount === undefined)) {
      throw new BadRequestException({
        code: 'charge_payload_required',
        message: 'A charge requires either a productId or a description with an amount.',
      });
    }

    const replay = await this.prisma.folioLine.findFirst({
      where: {
        organizationId: context.organizationId,
        propertyId,
        idempotencyKey: dto.idempotencyKey,
      },
      select: {
        id: true,
        folioId: true,
        description: true,
        amount: true,
        productId: true,
        quantity: true,
      },
    });
    if (replay !== null) {
      const sameProduct = (replay.productId ?? null) === productId;
      const sameQuantity = replay.quantity.equals(quantity);
      const sameManualPayload =
        productId !== null ||
        (replay.description === (dto.description ?? '').trim() &&
          replay.amount.equals(parseMoney(dto.amount ?? '', 'amount')));
      if (replay.folioId !== folioId || !sameProduct || !sameQuantity || !sameManualPayload) {
        throw this.idempotencyReuse('charge');
      }
      return this.get(context, folioId);
    }

    await this.prisma.$transaction(async (transaction) => {
      const folio = await this.lockFolio(transaction, context.organizationId, propertyId, folioId);
      if (folio.status !== FolioStatus.OPEN) {
        throw new ConflictException({
          code: 'folio_not_open',
          message: 'Charges can only be posted to an open folio.',
        });
      }
      if (dto.currencyCode !== undefined && dto.currencyCode !== folio.currencyCode) {
        throw new BadRequestException({
          code: 'currency_mismatch',
          message: `This folio uses ${folio.currencyCode}.`,
        });
      }

      const charge = await this.resolveCharge(transaction, {
        organizationId: context.organizationId,
        propertyId,
        productId,
        quantity,
        description: dto.description,
        amount: dto.amount,
        source: dto.source,
        folioCurrencyCode: folio.currencyCode,
      });

      const line = await transaction.folioLine.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          folioId,
          description: charge.description,
          amount: charge.amount,
          currencyCode: folio.currencyCode,
          status: FolioLineStatus.POSTED,
          productId,
          quantity,
          unitAmount: charge.unitAmount,
          unit: charge.unit,
          source: charge.source,
          idempotencyKey: dto.idempotencyKey,
          createdByUserId: context.actor.id,
        },
        select: { id: true, description: true, amount: true },
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'folio.charge_posted',
          entityType: 'FolioLine',
          entityId: line.id,
          correlationId: context.correlationId,
          metadata: {
            folioId,
            description: line.description,
            amount: money(line.amount),
            currencyCode: folio.currencyCode,
            productId,
            quantity: quantity.toFixed(2),
            unitAmount: charge.unitAmount === null ? null : money(charge.unitAmount),
            source: charge.source,
          },
        },
        transaction,
      );
    });

    return this.get(context, folioId);
  }

  async voidCharge(
    context: TenantContext,
    folioId: string,
    lineId: string,
    dto: VoidFolioChargeDto,
  ): Promise<FolioResponse> {
    const propertyId = requirePropertyContext(context);

    await this.prisma.$transaction(async (transaction) => {
      const folio = await this.lockFolio(transaction, context.organizationId, propertyId, folioId);
      if (folio.status !== FolioStatus.OPEN) {
        throw new ConflictException({
          code: 'folio_not_open',
          message: 'Charges can only be voided on an open folio.',
        });
      }

      const line = await transaction.folioLine.findFirst({
        where: { id: lineId, organizationId: context.organizationId, propertyId, folioId },
        select: { id: true, amount: true, status: true, voidReason: true },
      });
      if (line === null) {
        throw new NotFoundException({
          code: 'folio_line_not_found',
          message: 'Charge not found in this folio.',
        });
      }
      if (line.status === FolioLineStatus.VOID) {
        if (line.voidReason !== dto.reason) {
          throw new ConflictException({
            code: 'charge_already_voided',
            message: 'This charge was already voided with a different reason.',
          });
        }
        return;
      }

      const totals = await this.lockFolioTotals(
        transaction,
        context.organizationId,
        propertyId,
        folioId,
      );
      const remainingCharges = totals.charges.minus(line.amount);
      if (totals.payments.greaterThan(remainingCharges)) {
        throw new ConflictException({
          code: 'void_would_underfund_payments',
          message: 'Voiding this charge would leave recorded payments above the folio charges.',
        });
      }

      await transaction.folioLine.update({
        where: { id: line.id },
        data: {
          status: FolioLineStatus.VOID,
          voidedAt: new Date(),
          voidReason: dto.reason,
        },
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'folio.charge_voided',
          entityType: 'FolioLine',
          entityId: line.id,
          correlationId: context.correlationId,
          reason: dto.reason,
          metadata: { folioId, amount: money(line.amount), idempotencyKey: dto.idempotencyKey },
        },
        transaction,
      );
    });

    return this.get(context, folioId);
  }

  async recordPayment(
    context: TenantContext,
    folioId: string,
    dto: RecordPaymentDto,
  ): Promise<FolioResponse> {
    const propertyId = requirePropertyContext(context);
    const amount = parseMoney(dto.amount, 'amount');

    const replay = await this.prisma.payment.findFirst({
      where: {
        organizationId: context.organizationId,
        propertyId,
        idempotencyKey: dto.idempotencyKey,
      },
      select: { id: true, folioId: true, amount: true, method: true },
    });
    if (replay !== null) {
      if (
        replay.folioId !== folioId ||
        !replay.amount.equals(amount) ||
        replay.method !== dto.method
      ) {
        throw this.idempotencyReuse('payment');
      }
      return this.get(context, folioId);
    }

    await this.prisma.$transaction(async (transaction) => {
      const folio = await this.lockFolio(transaction, context.organizationId, propertyId, folioId);
      if (folio.status === FolioStatus.CANCELLED) {
        throw new ConflictException({
          code: 'folio_cancelled',
          message: 'Payments cannot be recorded on a cancelled folio.',
        });
      }
      if (folio.status === FolioStatus.SETTLED) {
        throw new ConflictException({
          code: 'folio_already_settled',
          message: 'This folio has no outstanding balance.',
        });
      }
      if (dto.currencyCode !== undefined && dto.currencyCode !== folio.currencyCode) {
        throw new BadRequestException({
          code: 'currency_mismatch',
          message: `This folio uses ${folio.currencyCode}.`,
        });
      }

      const totals = await this.lockFolioTotals(
        transaction,
        context.organizationId,
        propertyId,
        folioId,
      );
      const nextPaid = totals.payments.plus(amount);
      if (nextPaid.greaterThan(totals.charges)) {
        throw new ConflictException({
          code: 'payment_exceeds_balance',
          message: 'The payment exceeds the outstanding folio balance.',
          details: {
            balance: money(totals.balance),
            attempted: money(amount),
            currencyCode: folio.currencyCode,
          },
        });
      }

      const payment = await transaction.payment.create({
        data: {
          organizationId: context.organizationId,
          propertyId,
          folioId,
          amount,
          currencyCode: folio.currencyCode,
          method: dto.method,
          status: 'COMPLETED',
          referenceId: dto.referenceId ?? null,
          description: dto.description ?? null,
          idempotencyKey: dto.idempotencyKey,
          receivedByUserId: context.actor.id,
        },
        select: { id: true, amount: true, method: true },
      });

      const balance = totals.charges.minus(nextPaid);
      if (balance.isZero()) {
        await transaction.folio.update({
          where: { id: folioId },
          data: { status: FolioStatus.SETTLED, closedAt: new Date() },
        });
      }

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'folio.payment_recorded',
          entityType: 'Payment',
          entityId: payment.id,
          correlationId: context.correlationId,
          metadata: {
            folioId,
            amount: money(payment.amount),
            currencyCode: folio.currencyCode,
            method: payment.method,
            referenceId: dto.referenceId ?? null,
          },
        },
        transaction,
      );
    });

    return this.get(context, folioId);
  }

  async cancel(
    context: TenantContext,
    folioId: string,
    dto: CancelFolioDto,
  ): Promise<FolioResponse> {
    const propertyId = requirePropertyContext(context);

    await this.prisma.$transaction(async (transaction) => {
      const folio = await this.lockFolio(transaction, context.organizationId, propertyId, folioId);
      if (folio.status === FolioStatus.CANCELLED) {
        return;
      }

      const totals = await this.lockFolioTotals(
        transaction,
        context.organizationId,
        propertyId,
        folioId,
      );
      if (totals.payments.greaterThan(0)) {
        throw new ConflictException({
          code: 'folio_has_payments',
          message: 'A folio with recorded payments cannot be cancelled.',
        });
      }

      await transaction.folio.update({
        where: { id: folioId },
        data: { status: FolioStatus.CANCELLED, closedAt: new Date() },
      });

      await this.audit.append(
        {
          organizationId: context.organizationId,
          propertyId,
          actorUserId: context.actor.id,
          action: 'folio.cancelled',
          entityType: 'Folio',
          entityId: folioId,
          correlationId: context.correlationId,
          reason: dto.reason,
          metadata: { number: folio.number, idempotencyKey: dto.idempotencyKey },
        },
        transaction,
      );
    });

    return this.get(context, folioId);
  }

  private parseQuantity(value: string): Prisma.Decimal {
    const quantity = new Prisma.Decimal(value);
    if (quantity.lessThanOrEqualTo(0) || quantity.greaterThan(new Prisma.Decimal('9999'))) {
      throw new BadRequestException({
        code: 'invalid_quantity',
        message: 'quantity must be greater than zero and at most 9999.',
      });
    }
    return quantity.toDecimalPlaces(2);
  }

  /**
   * Resolves the charge payload. A catalog consumption always uses the price
   * stored in PostgreSQL at posting time (never a client-supplied amount) and
   * snapshots unit and description on the line.
   */
  private async resolveCharge(
    transaction: Transaction,
    input: {
      organizationId: string;
      propertyId: string;
      productId: string | null;
      quantity: Prisma.Decimal;
      description?: string;
      amount?: string;
      source?: FolioLineSource;
      folioCurrencyCode: string;
    },
  ): Promise<{
    description: string;
    amount: Prisma.Decimal;
    unitAmount: Prisma.Decimal | null;
    unit: string | null;
    source: FolioLineSource;
  }> {
    const requestedDescription = (input.description ?? '').trim();

    if (input.productId === null) {
      if (requestedDescription.length === 0) {
        throw new BadRequestException({
          code: 'charge_payload_required',
          message: 'A manual charge requires a description.',
        });
      }
      return {
        description: requestedDescription,
        amount: parseMoney(input.amount ?? '', 'amount'),
        unitAmount: null,
        unit: null,
        source: input.source ?? FolioLineSource.MANUAL,
      };
    }

    const product = await transaction.folioProduct.findFirst({
      where: {
        id: input.productId,
        organizationId: input.organizationId,
        propertyId: input.propertyId,
      },
      select: {
        id: true,
        name: true,
        unit: true,
        unitAmount: true,
        currencyCode: true,
        category: true,
        isActive: true,
      },
    });
    if (product === null) {
      throw new NotFoundException({
        code: 'product_not_found',
        message: 'Product not found in this property.',
      });
    }
    if (!product.isActive) {
      throw new ConflictException({
        code: 'product_inactive',
        message: 'This product is inactive and cannot be posted to a folio.',
      });
    }
    if (product.currencyCode !== input.folioCurrencyCode) {
      throw new BadRequestException({
        code: 'currency_mismatch',
        message: `This folio uses ${input.folioCurrencyCode}.`,
      });
    }

    const amount = product.unitAmount
      .times(input.quantity)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    if (amount.isZero()) {
      throw new BadRequestException({
        code: 'invalid_money_amount',
        message: 'The charge amount must be greater than zero.',
      });
    }

    const description = requestedDescription === '' ? product.name : requestedDescription;
    if (description.length > 120) {
      throw new BadRequestException({
        code: 'charge_description_too_long',
        message: 'The charge description must have at most 120 characters.',
      });
    }

    return {
      description,
      amount,
      unitAmount: product.unitAmount,
      unit: product.unit,
      source: input.source ?? CATEGORY_SOURCE[product.category],
    };
  }

  private async loadProperty(
    organizationId: string,
    propertyId: string,
  ): Promise<{ currencyCode: string; timezone: string }> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId },
      select: { currencyCode: true, timezone: true },
    });
    if (property === null) {
      throw new NotFoundException({
        code: 'property_not_found',
        message: 'Property not found in this organization.',
      });
    }
    return property;
  }

  private async resolveLink(
    transaction: Transaction,
    input: {
      organizationId: string;
      propertyId: string;
      stayId?: string;
      reservationId?: string;
    },
  ): Promise<{ stayId: string | null; reservationId: string | null }> {
    let reservationId = input.reservationId ?? null;

    if (input.stayId !== undefined) {
      const stay = await transaction.stay.findFirst({
        where: {
          id: input.stayId,
          organizationId: input.organizationId,
          propertyId: input.propertyId,
        },
        select: { id: true, reservationId: true },
      });
      if (stay === null) {
        throw new NotFoundException({
          code: 'stay_not_found',
          message: 'Stay not found in this property.',
        });
      }
      if (reservationId !== null && reservationId !== stay.reservationId) {
        throw new BadRequestException({
          code: 'folio_link_mismatch',
          message: 'The stay and reservation do not belong to each other.',
        });
      }
      reservationId = stay.reservationId;
    }

    if (reservationId !== null) {
      const reservation = await transaction.reservation.findFirst({
        where: {
          id: reservationId,
          organizationId: input.organizationId,
          propertyId: input.propertyId,
        },
        select: { id: true },
      });
      if (reservation === null) {
        throw new NotFoundException({
          code: 'reservation_not_found',
          message: 'Reservation not found in this property.',
        });
      }
    } else {
      throw new BadRequestException({
        code: 'folio_link_required',
        message: 'A folio must be linked to a stay or reservation.',
      });
    }

    return { stayId: input.stayId ?? null, reservationId };
  }

  private async lockFolio(
    transaction: Transaction,
    organizationId: string,
    propertyId: string,
    folioId: string,
  ): Promise<{
    id: string;
    number: string;
    status: FolioStatus;
    currencyCode: string;
    notes: string | null;
  }> {
    const rows = await transaction.$queryRaw<
      Array<{
        id: string;
        number: string;
        status: FolioStatus;
        currencyCode: string;
        notes: string | null;
      }>
    >`
      SELECT "id", "number", "status", "currencyCode", "notes"
      FROM "Folio"
      WHERE "organizationId" = ${organizationId}::uuid
        AND "propertyId" = ${propertyId}::uuid
        AND "id" = ${folioId}::uuid
      FOR UPDATE
    `;
    const folio = rows[0];
    if (folio === undefined) {
      throw new NotFoundException({ code: 'folio_not_found', message: 'Folio not found.' });
    }
    return folio;
  }

  private async lockFolioTotals(
    transaction: Transaction,
    organizationId: string,
    propertyId: string,
    folioId: string,
  ): Promise<FolioTotals> {
    const [lines, payments] = await Promise.all([
      transaction.folioLine.findMany({
        where: {
          organizationId,
          propertyId,
          folioId,
          status: FolioLineStatus.POSTED,
        },
        select: { amount: true, status: true },
      }),
      transaction.payment.findMany({
        where: { organizationId, propertyId, folioId, status: 'COMPLETED' },
        select: { amount: true, status: true },
      }),
    ]);

    return computeFolioTotals(lines, payments);
  }

  private generateNumber(timezone: string): string {
    const day = calendarDateInTimezone(new Date(), timezone).replaceAll('-', '');
    return `F-${day}-${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
  }

  private idempotencyReuse(scope: string): ConflictException {
    return new ConflictException({
      code: 'idempotency_key_reuse',
      message: `This idempotency key was already used with a different ${scope} payload.`,
    });
  }
}
