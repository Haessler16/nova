'use client';

import {
  Box,
  Button,
  Collapse,
  Input,
  Select,
  SimpleGrid,
  Text,
  Textarea,
} from '@chakra-ui/react';
import { useState } from 'react';
import { Field } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { CreateReservationController } from '../_hooks/use-create-reservation';
import { RoomChoiceGrid } from './room-choice-grid';

export function CreateRoomSection({ create }: { create: CreateReservationController }) {
  const { t } = useI18n();
  const { form, setForm, errors, datesValid, availability, lookup } = create;

  return (
    <Box>
      <Text fontWeight="semibold" mb={2}>
        {t('reservations.section.room')}
      </Text>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
        <Field label={t('reservations.field.roomType')} isRequired error={errors.roomTypeId}>
          <Select
            value={form.roomTypeId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                roomTypeId: event.target.value,
                roomId: '',
              }))
            }
            required
          >
            <option value="">{t('reservations.room.selectPlaceholder')}</option>
            {lookup.data?.roomTypes.map((roomType) => (
              <option key={roomType.id} value={roomType.id}>
                {t('reservations.room.typeOption', {
                  name: roomType.name,
                  capacity: roomType.capacityAdults,
                })}
              </option>
            ))}
          </Select>
        </Field>
        <Box alignSelf="end">
          <Text fontSize="xs" color="textSecondary">
            {form.roomTypeId === ''
              ? t('reservations.room.chooseType')
              : t('reservations.room.assignLater')}
          </Text>
        </Box>
      </SimpleGrid>

      {form.roomTypeId !== '' && datesValid && (
        <Box mt={3}>
          {availability.loading ? (
            <Text fontSize="sm" color="textSecondary">
              {t('reservations.room.checking')}
            </Text>
          ) : availability.error !== null ? (
            <Text fontSize="sm" color="danger.500">
              {errorMessage(availability.error)}
            </Text>
          ) : (availability.data?.items.length ?? 0) === 0 ? (
            <Text fontSize="sm" color="warning.600">
              {t('reservations.room.noneForRange')}
            </Text>
          ) : (
            <Box>
              <Text fontSize="xs" color="textSecondary" mb={2}>
                {availability.data?.items.length === 1
                  ? t('reservations.room.availableOne')
                  : t('reservations.room.availableOther')}
              </Text>
              <RoomChoiceGrid
                items={availability.data?.items ?? []}
                value={form.roomId}
                onChange={(roomId) => setForm((current) => ({ ...current, roomId }))}
                allowUnassigned
              />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export function CreateOptionalSection({ create }: { create: CreateReservationController }) {
  const { t } = useI18n();
  const { form, setForm, errors } = create;
  const [show, setShow] = useState(false);

  return (
    <Box>
      <Button size="xs" variant="ghost" onClick={() => setShow((current) => !current)} aria-expanded={show}>
        {show ? t('reservations.optional.hide') : t('reservations.optional.show')}
      </Button>
      <Collapse in={show} animateOpacity>
        <Box pt={3}>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
            <Field
              label={t('reservations.field.code')}
              error={errors.code}
              helper={t('reservations.field.codeHelper')}
            >
              <Input
                value={form.code}
                aria-label={t('reservations.field.codeAria')}
                maxLength={32}
                onChange={(event) =>
                  setForm((current) => ({ ...current, code: event.target.value }))
                }
              />
            </Field>
            <Field label={t('reservations.field.source')} error={errors.source}>
              <Input
                value={form.source}
                placeholder={t('reservations.field.sourcePlaceholder')}
                maxLength={32}
                onChange={(event) =>
                  setForm((current) => ({ ...current, source: event.target.value }))
                }
              />
            </Field>
          </SimpleGrid>
          <Field
            label={t('reservations.field.observation')}
            error={errors.notes}
            helper={t('reservations.field.observationHelper')}
          >
            <Textarea
              mt={3}
              rows={3}
              maxLength={2000}
              value={form.notes}
              placeholder="Ej.: RSV COM CAFE / PGTO DIRETO NO HOTEL (12-15/11) / LUXO CASAL"
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </Field>
        </Box>
      </Collapse>
    </Box>
  );
}
