import type { useI18n } from '@/lib/i18n';
import { formatCalendarDate } from '@/lib/format';
import type { CheckInWindow, ReservationInstruction, ReservationPartyMember } from '@/lib/types';

export type Translator = ReturnType<typeof useI18n>['t'];

export function nightsLabel(t: Translator, count: number): string {
  return t(count === 1 ? 'common.nightsOne' : 'common.nightsOther', { count });
}

export function adultsLabel(t: Translator, count: number): string {
  return t(count === 1 ? 'common.adultsOne' : 'common.adultsOther', { count });
}

export function minorsLabel(t: Translator, count: number): string {
  return t(count === 1 ? 'common.minorsOne' : 'common.minorsOther', { count });
}

export function blockedWindowMessage(window: CheckInWindow, t: Translator): string {
  if (window.code === 'check_in_too_early') {
    return t('checkIn.blockedTooEarly', {
      date: formatCalendarDate(window.checkInDate),
      today: formatCalendarDate(window.localDate),
    });
  }
  return t('checkIn.blockedElapsed', {
    date: formatCalendarDate(window.checkOutDate),
    today: formatCalendarDate(window.localDate),
  });
}

/**
 * The check-in summary is intentionally narrower than the reservation panel:
 * only instructions actionable at arrival/check-in or high-risk alerts are
 * shown. Billing, check-out tasks and general notes stay in the reservation.
 */
export function isCheckInRelevant(instruction: ReservationInstruction): boolean {
  if (instruction.status === 'COMPLETED' || instruction.status === 'DISMISSED') {
    return false;
  }
  if (instruction.executionMoment === 'PRE_ARRIVAL' || instruction.executionMoment === 'CHECK_IN') {
    return true;
  }
  if (
    instruction.actionType === 'PAYMENT_PREAUTHORIZATION' ||
    instruction.actionType === 'ARRIVAL_REMINDER'
  ) {
    return true;
  }
  return instruction.priority === 'CRITICAL';
}

export function documentLabel(member: ReservationPartyMember, t: Translator): string {
  if (member.documentType === null || member.documentNumber === null) {
    return t('checkIn.party.documentMissing');
  }
  return `${member.documentType} ${member.documentNumber}`;
}
