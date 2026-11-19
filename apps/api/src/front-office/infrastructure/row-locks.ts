import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type Transaction = Prisma.TransactionClient;

/**
 * Closed list of lockable tables. Table names are never interpolated from user
 * input: callers select an entity key and the identifier comes from here.
 */
const LOCKABLE = {
  Reservation: {
    table: Prisma.raw('"Reservation"'),
    code: 'reservation_not_found',
    label: 'Reservation',
  },
  Stay: { table: Prisma.raw('"Stay"'), code: 'stay_not_found', label: 'Stay' },
} as const;

export type LockableEntity = keyof typeof LOCKABLE;

/**
 * Takes a `FOR UPDATE` lock on a row scoped to the tenant and property. Throws
 * the same not-found error the caller used before this helper existed.
 */
export async function lockRow(
  tx: Transaction,
  entity: LockableEntity,
  scope: { organizationId: string; propertyId: string; id: string },
): Promise<void> {
  const { table, code, label } = LOCKABLE[entity];
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM ${table}
    WHERE "id" = ${scope.id}::uuid
      AND "organizationId" = ${scope.organizationId}::uuid
      AND "propertyId" = ${scope.propertyId}::uuid
    FOR UPDATE
  `);
  if (rows.length === 0) {
    throw new NotFoundException({
      code,
      message: `${label} not found in the selected property.`,
    });
  }
}
