'use client';

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import { DateField } from '@/components/date-field';
import { Field } from '@/components/ui';
import { addDaysISO, todayISO } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Guest } from '@/lib/types';
import type { Tenant } from '../_hooks/use-reservation-list';
import type { CreateReservationController } from '../_hooks/use-create-reservation';
import { GuestPicker } from './guest-picker';
import { CreateOptionalSection, CreateRoomSection } from './create-room-section';

function StaySection({ create }: { create: CreateReservationController }) {
  const { t } = useI18n();
  const { form, setForm, errors, datesValid, nights } = create;

  return (
    <div>
      <Text fontWeight="semibold" mb={2}>
        {t('reservations.section.stay')}
      </Text>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
        <Field label={t('reservations.field.checkIn')} isRequired error={errors.checkInDate}>
          <DateField
            value={form.checkInDate}
            placeholder="dd/mm/aaaa"
            ariaLabel={t('reservations.field.checkInAria')}
            onChange={(checkInDate) =>
              setForm((current) => ({
                ...current,
                checkInDate,
                checkOutDate:
                  current.checkOutDate <= checkInDate
                    ? addDaysISO(checkInDate, 1)
                    : current.checkOutDate,
                roomId: '',
              }))
            }
          />
        </Field>
        <Field label={t('reservations.field.checkOut')} isRequired error={errors.checkOutDate}>
          <DateField
            value={form.checkOutDate}
            min={form.checkInDate}
            placeholder="dd/mm/aaaa"
            ariaLabel={t('reservations.field.checkOutAria')}
            onChange={(checkOutDate) =>
              setForm((current) => ({ ...current, checkOutDate, roomId: '' }))
            }
          />
        </Field>
        <Field label={t('reservations.field.adults')} isRequired error={errors.adults}>
          <Input
            type="number"
            min={1}
            max={20}
            value={form.adults}
            onChange={(event) => setForm((current) => ({ ...current, adults: event.target.value }))}
            required
          />
        </Field>
        <Field label={t('reservations.field.children')} error={errors.children}>
          <Input
            type="number"
            min={0}
            max={20}
            value={form.children}
            onChange={(event) =>
              setForm((current) => ({ ...current, children: event.target.value }))
            }
          />
        </Field>
      </SimpleGrid>
      <Text mt={2} fontSize="xs" color={datesValid ? 'textSecondary' : 'danger.500'}>
        {datesValid
          ? nights === 1
            ? t('reservations.stay.summaryOne', { count: nights })
            : t('reservations.stay.summaryOther', { count: nights })
          : t('reservations.stay.invalidRange')}
      </Text>
    </div>
  );
}

export function CreateReservationModal({
  tenant,
  create,
  selectedGuest,
  onSelectGuest,
  onClearGuest,
  onEditGuest,
}: {
  tenant: Tenant;
  create: CreateReservationController;
  selectedGuest: Guest | null;
  onSelectGuest: (guest: Guest) => void;
  onClearGuest: () => void;
  onEditGuest: (guest: Guest) => void;
}) {
  const { t } = useI18n();

  return (
    <Modal
      isOpen={create.modal.isOpen}
      onClose={create.modal.onClose}
      size="4xl"
      scrollBehavior="inside"
    >
      <ModalOverlay />{' '}
      <ModalContent
        as="form"
        my={4}
        maxH="calc(100vh - 2rem)"
        onSubmit={(event) => void create.submit(event)}
      >
        <ModalHeader>{t('reservations.new')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody py={4}>
          <Stack spacing={4}>
            <GuestPicker
              tenant={tenant}
              enabled={create.modal.isOpen}
              selectedGuest={selectedGuest}
              guestError={create.errors.guestId}
              onSelect={onSelectGuest}
              onClear={onClearGuest}
              onEdit={onEditGuest}
            />
            <StaySection create={create} />
            <CreateRoomSection create={create} />
            <CreateOptionalSection create={create} />
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={create.modal.onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" colorScheme="brand" isLoading={create.saving}>
            {t('reservations.create.submit')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
