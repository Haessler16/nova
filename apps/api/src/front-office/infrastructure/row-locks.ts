import { NotFoundException } from '@nestjs/common';
import { HousekeepingState, Prisma } from '@prisma/client';
import type { RoomStateService } from '../../inventory/room-state.service';
import {
  RESERVATION_SUMMARY_SELECT,
  STAY_SELECT,
  type ReservationSummaryRow,
  type StayRow,
  type Transaction,
} from '../application/front-office.contracts';

export type { Transaction };

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
  Incident: { table: Prisma.raw('"Incident"'), code: 'incident_not_found', label: 'Incident' },
} as const;

type LockableEntity = keyof typeof LOCKABLE;

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

interface RowScope {
  organizationId: string;
  propertyId: string;
  id: string;
}

/** Locks a reservation row and reads it back with the shared projection. */
export async function lockReservationRow(
  tx: Transaction,
  scope: RowScope,
): Promise<ReservationSummaryRow> {
  await lockRow(tx, 'Reservation', scope);
  return tx.reservation.findFirstOrThrow({
    where: { id: scope.id },
    select: RESERVATION_SUMMARY_SELECT,
  });
}

/** Locks a stay row and reads it back with the shared projection. */
export async function lockStayRow(tx: Transaction, scope: RowScope): Promise<StayRow> {
  await lockRow(tx, 'Stay', scope);
  return tx.stay.findFirstOrThrow({
    where: { id: scope.id },
    select: STAY_SELECT,
  });
}

export interface RoomLockRow {
  id: string;
  status: string;
  operationalState: string;
  housekeepingState: HousekeepingState;
  roomTypeId: string;
  number: string;
}

/**
 * Delegates the `FOR UPDATE` on the room to `RoomStateService` (which owns the
 * room state machine) and returns the columns the callers validate.
 */
export async function lockRoomRow(
  roomState: Pick<RoomStateService, 'lockRoom'>,
  tx: Transaction,
  scope: RowScope,
): Promise<RoomLockRow> {
  await roomState.lockRoom(tx, scope.organizationId, scope.propertyId, scope.id);
  const room = await tx.room.findFirst({
    where: {
      id: scope.id,
      organizationId: scope.organizationId,
      propertyId: scope.propertyId,
    },
    select: {
      id: true,
      status: true,
      operationalState: true,
      housekeepingState: true,
      roomTypeId: true,
      number: true,
    },
  });
  if (room === null) {
    throw new NotFoundException({
      code: 'room_not_found',
      message: 'Room not found in the selected property.',
    });
  }
  return room;
}
