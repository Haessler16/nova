import type { useI18n } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n/dictionary';
import type { MinorSupervision } from '@/lib/types';

export type Translator = ReturnType<typeof useI18n>['t'];

export const SUPERVISION_LABEL_KEYS: Record<MinorSupervision, TranslationKey> = {
  ACCOMPANIED: 'party.supervision.accompanied',
  UNACCOMPANIED_AUTHORIZED: 'party.supervision.authorized',
  UNACCOMPANIED_WITHOUT_AUTHORIZATION: 'party.supervision.withoutAuthorization',
  UNKNOWN: 'party.supervision.unknown',
};

export function supervisionLabel(t: Translator, value: MinorSupervision): string {
  return t(SUPERVISION_LABEL_KEYS[value]);
}

const READINESS_LABEL_KEYS: Record<string, TranslationKey> = {
  PRIMARY_MISSING: 'party.readiness.primaryMissing',
  GUEST_COUNT_MISMATCH: 'party.readiness.guestCountMismatch',
  AGE_GROUP_UNKNOWN: 'party.readiness.ageGroupUnknown',
  PRIMARY_NOT_ADULT: 'party.readiness.primaryNotAdult',
  MINOR_RESPONSIBLE_MISSING: 'party.readiness.minorResponsibleMissing',
  MINOR_SUPERVISION_UNKNOWN: 'party.readiness.minorSupervisionUnknown',
  MINOR_AUTHORIZATION_MISSING: 'party.readiness.minorAuthorizationMissing',
  MINOR_AUTHORIZATION_REFERENCE_MISSING: 'party.readiness.minorAuthorizationReferenceMissing',
  LEGAL_INCAPACITY_RESPONSIBLE_MISSING: 'party.readiness.legalIncapacityResponsibleMissing',
  DOCUMENT_NOT_FNRH_READY: 'party.readiness.documentNotFnrhReady',
  PROFILE_INCOMPLETE: 'party.readiness.profileIncomplete',
};

export function readinessLabel(t: Translator, code: string): string {
  const key = READINESS_LABEL_KEYS[code];
  return key === undefined ? code : t(key);
}

export function adultsLabel(t: Translator, count: number): string {
  return count === 1
    ? t('party.summary.adultsOne', { count })
    : t('party.summary.adultsOther', { count });
}

export function minorsLabel(t: Translator, count: number): string {
  return count === 1
    ? t('party.summary.minorsOne', { count })
    : t('party.summary.minorsOther', { count });
}
