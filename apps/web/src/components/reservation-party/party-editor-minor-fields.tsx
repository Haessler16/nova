'use client';

import { FormControl, FormLabel, Input, Select } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { MinorSupervision, ReservationPartyMember } from '@/lib/types';
import { SUPERVISION_LABEL_KEYS, supervisionLabel } from './lib/party-labels';
import type { EditorForm } from './lib/party-utils';

export function PartyEditorMinorFields({
  form,
  patch,
  responsibleOptions,
}: {
  form: EditorForm;
  patch: (next: Partial<EditorForm>) => void;
  responsibleOptions: ReservationPartyMember[];
}) {
  const { t } = useI18n();

  return (
    <>
      <FormControl isRequired>
        <FormLabel fontSize="sm">{t('party.field.responsible')}</FormLabel>
        <Select
          data-testid="party-responsible"
          value={form.responsibleReservationGuestId}
          onChange={(event) => patch({ responsibleReservationGuestId: event.target.value })}
        >
          <option value="">{t('reservations.room.selectPlaceholder')}</option>
          {responsibleOptions.map((member) => (
            <option key={member.reservationGuestId} value={member.reservationGuestId ?? ''}>
              {member.fullName}
            </option>
          ))}
        </Select>
      </FormControl>
      <FormControl isRequired>
        <FormLabel fontSize="sm">{t('party.field.supervision')}</FormLabel>
        <Select
          data-testid="party-supervision"
          value={form.minorSupervision}
          onChange={(event) => patch({ minorSupervision: event.target.value as MinorSupervision })}
        >
          {(Object.keys(SUPERVISION_LABEL_KEYS) as MinorSupervision[])
            .filter((value) => value !== 'UNKNOWN')
            .map((value) => (
              <option key={value} value={value}>
                {supervisionLabel(t, value)}
              </option>
            ))}
        </Select>
      </FormControl>
      {form.minorSupervision === 'UNACCOMPANIED_AUTHORIZED' && (
        <FormControl isRequired>
          <FormLabel fontSize="sm">{t('party.field.authorizationReference')}</FormLabel>
          <Input
            data-testid="party-authorization-reference"
            value={form.authorizationReference}
            onChange={(event) => patch({ authorizationReference: event.target.value })}
            placeholder={t('party.field.authorizationPlaceholder')}
          />
        </FormControl>
      )}
    </>
  );
}
