import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FolioLineStatus, FolioStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../common/http/request-context';
import { money, parseMoney } from '../common/money/decimal';
import { Clock } from '../common/time/clock';
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
import {
  assertChargePayload,
  chargeReplayMatches,
  parseChargeQuantity,
  resolveFolioCharge,
} from './folio.charges';
import {
  FOLIO_SELECT,
  mapFolio,
  type FolioResponse,
  type FolioRow,
} from './folio.contracts';
import { getFolio, listFolios } from './folio.queries';
import {
  generateFolioNumber,
  idempotencyReuse,
  loadFolioProperty,
  lockFolio,
  lockFolioTotals,
  resolveFolioLink,
} from './folio.support';

export type {
  FolioLineResponse,
  FolioResponse,
  PaymentResponse,
} from './folio.contracts';

@Injectable()
export class FolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  async list(
    context: TenantContext,
    query: ListFoliosQueryDto,
  ): Promise<{ items: FolioResponse[] }> {
    return listFolios(this.prisma, context.organizationId, requirePropertyContext(context), query);
  }

  async get(context: TenantContext, folioId: string): Promise<FolioResponse> {
    return getFolio(this.prisma, context.organizationId, requirePropertyContext(context), folioId);
  }

  async create(context: TenantContext, dto: CreateFolioDto): Promise<FolioResponse> {
    const propertyId = requirePropertyContext(context);
    const property = await loadFolioProperty(this.prisma, context.organizationId, propertyId);

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
        throw idempotencyReuse('folio');
      }
      return mapFolio(existing);
    }

    let created: FolioRow;
    try {
      created = await this.prisma.$transaction(async (transaction) => {
        const link = await resolveFolioLink(transaction, {
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
            number: generateFolioNumber(this.clock, property.timezone),
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
      dto.quantity === undefined ? new Prisma.Decimal(1) : parseChargeQuantity(dto.quantity);

    assertChargePayload(productId, dto);

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
      if (!chargeReplayMatches(replay, folioId, dto, productId, quantity)) {
        throw idempotencyReuse('charge');
      }
      return this.get(context, folioId);
    }

    await this.prisma.$transaction(async (transaction) => {
      const folio = await lockFolio(transaction, context.organizationId, propertyId, folioId);
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

      const charge = await resolveFolioCharge(transaction, {
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
      const folio = await lockFolio(transaction, context.organizationId, propertyId, folioId);
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

      const totals = await lockFolioTotals(
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
          voidedAt: this.clock.now(),
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
        throw idempotencyReuse('payment');
      }
      return this.get(context, folioId);
    }

    await this.prisma.$transaction(async (transaction) => {
      const folio = await lockFolio(transaction, context.organizationId, propertyId, folioId);
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

      const totals = await lockFolioTotals(
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
          data: { status: FolioStatus.SETTLED, closedAt: this.clock.now() },
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
      const folio = await lockFolio(transaction, context.organizationId, propertyId, folioId);
      if (folio.status === FolioStatus.CANCELLED) {
        return;
      }

      const totals = await lockFolioTotals(
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
        data: { status: FolioStatus.CANCELLED, closedAt: this.clock.now() },
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
}
