'use client';

import { Select, SimpleGrid } from '@chakra-ui/react';
import { Field } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { FrontOfficeOverview, Stay } from '@/lib/types';
import type { IncidentForm, IncidentScope } from '../_lib/front-office.types';

export function IncidentScopeFields({
  form,
  update,
  data,
  inHouse,
}: {
  form: IncidentForm;
  update: <K extends keyof IncidentForm>(key: K, value: IncidentForm[K]) => void;
  data: FrontOfficeOverview | null;
  inHouse: Stay[];
}) {
  const { t } = useI18n();

  return (
    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
      <Field label={t('frontOffice.incidentForm.scope')}>
        <Select
          value={form.scope}
          onChange={(event) => update('scope', event.target.value as IncidentScope)}
        >
          <option value="none">{t('frontOffice.incidentForm.scopeNone')}</option>
          <option value="room">{t('frontOffice.incidentForm.scopeRoom')}</option>
          <option value="stay">{t('frontOffice.incidentForm.scopeStay')}</option>
        </Select>
      </Field>
      {form.scope === 'room' && (
        <Field label={t('frontOffice.incidentForm.room')}>
          <Select value={form.roomId} onChange={(event) => update('roomId', event.target.value)}>
            <option value="">{t('frontOffice.incidentForm.selectPlaceholder')}</option>
            {data?.roomRack.map((room) => (
              <option key={room.id} value={room.id}>
                {t('frontOffice.incidentForm.roomOption', {
                  number: room.number,
                  type: room.roomType.name,
                })}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {form.scope === 'stay' && (
        <Field label={t('frontOffice.incidentForm.stayField')}>
          <Select value={form.stayId} onChange={(event) => update('stayId', event.target.value)}>
            <option value="">{t('frontOffice.incidentForm.selectPlaceholder')}</option>
            {inHouse.map((stay) => (
              <option key={stay.id} value={stay.id}>
                {t('frontOffice.incidentForm.stayOption', {
                  number: stay.room.number,
                  name: stay.guest.fullName,
                })}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </SimpleGrid>
  );
}
