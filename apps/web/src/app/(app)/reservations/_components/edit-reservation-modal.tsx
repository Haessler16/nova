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
  Textarea,
} from '@chakra-ui/react';
import { DateField } from '@/components/date-field';
import { Field } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { ReservationEditController } from '../_hooks/use-reservation-edit';

export function EditReservationModal({ edit }: { edit: ReservationEditController }) {
  const { t } = useI18n();
  const { form, setForm, errors } = edit;

  return (
    <Modal isOpen={edit.modal.isOpen} onClose={edit.modal.onClose} size="lg">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={(event) => void edit.submit(event)}>
        <ModalHeader>{t('reservations.edit.title')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <SimpleGrid columns={2} spacing={4}>
              <Field label={t('reservations.field.checkIn')} isRequired error={errors.checkInDate}>
                <DateField
                  value={form.checkInDate}
                  placeholder="dd/mm/aaaa"
                  ariaLabel={t('reservations.field.checkInAria')}
                  onChange={(checkInDate) =>
                    setForm((current) => ({ ...current, checkInDate }))
                  }
                />
              </Field>
              <Field
                label={t('reservations.field.checkOut')}
                isRequired
                error={errors.checkOutDate}
              >
                <DateField
                  value={form.checkOutDate}
                  min={form.checkInDate !== '' ? form.checkInDate : undefined}
                  placeholder="dd/mm/aaaa"
                  ariaLabel={t('reservations.field.checkOutAria')}
                  onChange={(checkOutDate) =>
                    setForm((current) => ({ ...current, checkOutDate }))
                  }
                />
              </Field>
            </SimpleGrid>
            {errors.dates !== undefined && (
              <Text fontSize="xs" color="danger.500">
                {errors.dates}
              </Text>
            )}
            <SimpleGrid columns={2} spacing={4}>
              <Field label={t('reservations.field.adults')} isRequired error={errors.adults}>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={form.adults}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, adults: event.target.value }))
                  }
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
            <Field
              label={t('reservations.field.notes')}
              error={errors.notes}
              helper={t('reservations.field.notesHelper')}
            >
              <Textarea
                rows={3}
                maxLength={2000}
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </Field>
            <Text fontSize="xs" color="textSecondary">
              {t('reservations.edit.warning')}
            </Text>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={edit.modal.onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" colorScheme="brand" isLoading={edit.saving}>
            {t('common.save')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
