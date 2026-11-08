import { UnprocessableEntityException } from '@nestjs/common';
import { HousekeepingState } from '@prisma/client';

/**
 * Explicit housekeeping workflow. Occupancy is intentionally absent: this
 * state only describes cleaning/inspection readiness.
 */
export const HOUSEKEEPING_TRANSITIONS: Record<HousekeepingState, readonly HousekeepingState[]> = {
  DIRTY: ['CLEANING'],
  CLEANING: ['CLEAN', 'DIRTY'],
  CLEAN: ['INSPECTED', 'DIRTY'],
  INSPECTED: ['DIRTY'],
};

export function assertHousekeepingTransition(from: HousekeepingState, to: HousekeepingState): void {
  const allowed = HOUSEKEEPING_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new UnprocessableEntityException({
      code: 'invalid_housekeeping_transition',
      message: `Housekeeping state cannot move from ${from} to ${to}.`,
      details: { from, to, allowed },
    });
  }
}
