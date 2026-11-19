import { HousekeepingState } from '@prisma/client';
import { formatCalendarDate } from '../reservations/reservation-dates';
import type { CheckInWindow } from './application/front-office.contracts';

/**
 * Housekeeping states that block a normal check-in. `CLEAN` is accepted even
 * though inspection has not been recorded: whether pending inspection blocks
 * check-in is a property policy decision, so the default is reversible and
 * documented as an open question. DIRTY/CLEANING always block.
 */
export const CHECK_IN_BLOCKED_HOUSEKEEPING_STATES: HousekeepingState[] = [
  HousekeepingState.DIRTY,
  HousekeepingState.CLEANING,
];

/**
 * Single source of truth for the check-in window: the property local calendar
 * date must be within `[checkInDate, checkOutDate)`. The operational day only
 * drives lists and the room rack (ADR-027).
 */
export function buildCheckInWindow(
  localDate: string,
  checkInDate: Date,
  checkOutDate: Date,
): CheckInWindow {
  const checkIn = formatCalendarDate(checkInDate);
  const checkOut = formatCalendarDate(checkOutDate);
  const code =
    localDate < checkIn
      ? 'check_in_too_early'
      : localDate >= checkOut
        ? 'check_in_window_elapsed'
        : null;
  return {
    localDate,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    allowed: code === null,
    code,
  };
}
