import type { Translator } from './party-labels';
import { ageAtCheckIn, type EditorForm, type EditorState } from './party-utils';

export function validatePartyForm(
  t: Translator,
  editor: EditorState,
  form: EditorForm,
  checkInDate: string,
): string | null {
  const fullName = form.fullName.trim();
  const age = ageAtCheckIn(form.birthDate, checkInDate);

  if (fullName.length < 2) return t('party.error.fullName');
  if (!form.birthDate) return t('party.error.birthDate');
  if (editor.kind === 'adult' && age < 18) return t('party.error.adultIsMinor');
  if (editor.kind === 'minor' && age >= 18) return t('party.error.minorIsAdult');
  if (editor.kind === 'minor' && form.responsibleReservationGuestId === '') {
    return t('party.error.responsible');
  }
  if (
    editor.kind === 'minor' &&
    form.minorSupervision === 'UNACCOMPANIED_AUTHORIZED' &&
    form.authorizationReference.trim() === ''
  ) {
    return t('party.error.authorization');
  }
  if (form.documentType === 'CPF' && form.documentNumber.replace(/\D/g, '').length !== 11) {
    return t('party.error.cpf');
  }
  return null;
}

export function buildPartyPayload(
  editor: EditorState,
  form: EditorForm,
  editing: boolean,
): Record<string, unknown> {
  const fullName = form.fullName.trim();
  const payload: Record<string, unknown> = {
    birthDate: form.birthDate,
    ...(editor.kind === 'minor'
      ? {
          minorSupervision: form.minorSupervision,
          responsibleReservationGuestId: form.responsibleReservationGuestId,
          authorizationReference: form.authorizationReference.trim(),
        }
      : {}),
  };

  if (!editing) {
    if (form.guestId !== null) {
      payload.guestId = form.guestId;
    } else {
      payload.fullName = fullName;
      payload.email = form.email.trim();
      payload.phone = form.phone.trim();
      if (form.documentType !== '') {
        payload.documentType = form.documentType;
        payload.documentNumber = form.documentNumber.trim();
      }
    }
  } else {
    payload.fullName = fullName;
    payload.email = form.email.trim();
    payload.phone = form.phone.trim();
    if (form.documentType === '') {
      payload.documentType = null;
      payload.documentNumber = null;
    } else {
      payload.documentType = form.documentType;
      payload.documentNumber = form.documentNumber.trim();
    }
  }

  return payload;
}
