import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FolioLineStatus, FolioStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Clock } from '../common/time/clock';
import { calendarDateInTimezone } from '../common/time/property-day';
import { computeFolioTotals } from './folio-totals';
import type { PrismaService } from '../prisma/prisma.service';
import type { FolioTotals, Transaction } from './folio.contracts';

export interface LockedFolio {
  id: string;
  number: string;
  status: FolioStatus;
  currencyCode: string;
  notes: string | null;
}

export async function loadFolioProperty(
  prisma: PrismaService,
  organizationId: string,
  propertyId: string,
): Promise<{ currencyCode: string; timezone: string }> {
  const property = await prisma.property.findFirst({
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

/** Resolves and cross-checks the stay/reservation a folio is opened for. */
export async function resolveFolioLink(
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

  if (reservationId === null) {
    throw new BadRequestException({
      code: 'folio_link_required',
      message: 'A folio must be linked to a stay or reservation.',
    });
  }

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

  return { stayId: input.stayId ?? null, reservationId };
}

export async function lockFolio(
  transaction: Transaction,
  organizationId: string,
  propertyId: string,
  folioId: string,
): Promise<LockedFolio> {
  const rows = await transaction.$queryRaw<LockedFolio[]>`
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

export async function lockFolioTotals(
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

export function generateFolioNumber(clock: Clock, timezone: string): string {
  const day = calendarDateInTimezone(clock.now(), timezone).replaceAll('-', '');
  return `F-${day}-${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
}

export function idempotencyReuse(scope: string): ConflictException {
  return new ConflictException({
    code: 'idempotency_key_reuse',
    message: `This idempotency key was already used with a different ${scope} payload.`,
  });
}
