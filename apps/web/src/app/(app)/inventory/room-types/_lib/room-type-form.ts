import type { RoomType } from '@/lib/types';
import type { TranslationKey, TranslationVars } from '@/lib/i18n';
import type { RoomTypeFieldLabels, ValidationCopy } from '@/lib/validation';

export interface RoomTypeForm {
  name: string;
  code: string;
  description: string;
  capacityAdults: string;
  capacityChildren: string;
  bedType: string;
  status: 'ACTIVE' | 'DISABLED';
}

export const EMPTY_FORM: RoomTypeForm = {
  name: '',
  code: '',
  description: '',
  capacityAdults: '2',
  capacityChildren: '0',
  bedType: '',
  status: 'ACTIVE',
};

export function formFromRoomType(roomType: RoomType, status: RoomTypeForm['status']) {
  return {
    name: roomType.name,
    code: roomType.code,
    description: roomType.description ?? '',
    capacityAdults: String(roomType.capacityAdults),
    capacityChildren: String(roomType.capacityChildren),
    bedType: roomType.bedType ?? '',
    status,
  };
}

/** Dictionary-backed messages/labels for the shared room-type validator. */
export function buildValidationCopy(
  t: (key: TranslationKey, vars?: TranslationVars) => string,
): ValidationCopy {
  return {
    required: (label) => t('validation.required', { label }),
    maxLength: (label, max) => t('validation.maxLength', { label, max }),
    integer: (label) => t('validation.integer', { label }),
    range: (label, min, max) => t('validation.range', { label, min, max }),
  };
}

export function buildValidationLabels(
  t: (key: TranslationKey, vars?: TranslationVars) => string,
): RoomTypeFieldLabels {
  return {
    name: t('validation.roomType.name'),
    codeRequired: t('validation.roomType.codeRequired'),
    codeInvalid: t('validation.roomType.codeInvalid'),
    description: t('validation.roomType.description'),
    capacityAdults: t('validation.roomType.capacityAdults'),
    capacityChildren: t('validation.roomType.capacityChildren'),
    bedType: t('validation.roomType.bedType'),
  };
}
