import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FolioLineSource, FolioProductCategory, Prisma } from '@prisma/client';
import { parseMoney } from '../common/money/decimal';
import type { AddFolioChargeDto } from './dto/folio.dto';
import type { Transaction } from './folio.contracts';

/** Default provenance for a catalog consumption, derived from its category. */
const CATEGORY_SOURCE: Record<FolioProductCategory, FolioLineSource> = {
  MINIBAR: FolioLineSource.MINIBAR,
  FOOD_BEVERAGE: FolioLineSource.FRONT_DESK,
  PARKING: FolioLineSource.PARKING,
  LAUNDRY: FolioLineSource.SERVICE,
  SERVICE: FolioLineSource.SERVICE,
  OTHER: FolioLineSource.FRONT_DESK,
};

export interface ResolvedCharge {
  description: string;
  amount: Prisma.Decimal;
  unitAmount: Prisma.Decimal | null;
  unit: string | null;
  source: FolioLineSource;
}

export function assertChargePayload(productId: string | null, dto: AddFolioChargeDto): void {
  if (productId === null && (dto.description === undefined || dto.amount === undefined)) {
    throw new BadRequestException({
      code: 'charge_payload_required',
      message: 'A charge requires either a productId or a description with an amount.',
    });
  }
}

export function parseChargeQuantity(value: string): Prisma.Decimal {
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
export async function resolveFolioCharge(
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
): Promise<ResolvedCharge> {
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

export interface ChargeReplayRow {
  folioId: string;
  description: string;
  amount: Prisma.Decimal;
  productId: string | null;
  quantity: Prisma.Decimal;
}

/**
 * A replayed idempotency key is only accepted when it describes the same charge:
 * same folio, same product, same quantity and, for manual charges, same
 * description and amount.
 */
export function chargeReplayMatches(
  replay: ChargeReplayRow,
  folioId: string,
  dto: AddFolioChargeDto,
  productId: string | null,
  quantity: Prisma.Decimal,
): boolean {
  const sameProduct = (replay.productId ?? null) === productId;
  const sameQuantity = replay.quantity.equals(quantity);
  const sameManualPayload =
    productId !== null ||
    (replay.description === (dto.description ?? '').trim() &&
      replay.amount.equals(parseMoney(dto.amount ?? '', 'amount')));
  return replay.folioId === folioId && sameProduct && sameQuantity && sameManualPayload;
}
