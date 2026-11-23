import type { useI18n } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n/dictionary';
import type { ValidationCopy } from '@/lib/validation';

export type Translator = ReturnType<typeof useI18n>['t'];

/**
 * Validation templates for this screen. `lib/validation` keeps the historical
 * Spanish text as its default, so passing this object is what localizes the
 * messages instead of duplicating the rules here.
 */
export function validationCopy(t: Translator): ValidationCopy {
  return {
    required: (label) => t('validation.required', { label }),
    maxLength: (label, max) => t('validation.maxLength', { label, max }),
    integer: (label) => t('validation.integer', { label }),
    range: (label, min, max) => t('validation.range', { label, min, max }),
    minLength: (label, min) => t('validation.minLength', { label, min }),
    date: (label) => t('validation.date', { label }),
    dateOrder: t('validation.dateOrder'),
    nights: (max) => t('validation.nights', { max }),
    code: t('validation.code'),
    emailRequired: t('validation.emailRequired'),
    emailInvalid: t('validation.emailInvalid'),
    phoneInvalid: t('validation.phoneInvalid'),
  };
}

export function guestFieldLabels(t: Translator) {
  return {
    fullName: t('validation.label.guestName'),
    documentNumber: t('validation.label.guestDocumentNumber'),
    notes: t('validation.label.notes'),
  };
}

const ACTION_LABEL_KEYS: Record<string, TranslationKey> = {
  'reservation.created': 'reservations.action.created',
  'reservation.updated': 'reservations.action.updated',
  'reservation.room_assigned': 'reservations.action.roomAssigned',
  'reservation.room_reassigned': 'reservations.action.roomReassigned',
  'reservation.room_unassigned': 'reservations.action.roomUnassigned',
  'reservation.cancelled': 'reservations.action.cancelled',
  'reservation.status_changed': 'reservations.action.statusChanged',
  'reservation.checked_in': 'reservations.action.checkedIn',
  'reservation.checked_out': 'reservations.action.checkedOut',
  'reservation.room_moved': 'reservations.action.roomMoved',
  'reservation.no_show': 'reservations.action.noShow',
};

export function actionLabel(t: Translator, action: string): string {
  const key = ACTION_LABEL_KEYS[action];
  return key === undefined ? action : t(key);
}

export function adultsLabel(t: Translator, count: number): string {
  return count === 1
    ? t('reservations.adultsOne', { count })
    : t('reservations.adultsOther', { count });
}

export function childrenLabel(t: Translator, count: number): string {
  return count === 1
    ? t('reservations.childrenOne', { count })
    : t('reservations.childrenOther', { count });
}

export function nightsLabel(t: Translator, count: number): string {
  return count === 1
    ? t('reservations.nightsOne', { count })
    : t('reservations.nightsOther', { count });
}
