'use client';

import {
  Badge,
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Field } from '@/components/ui';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { reservationStatusLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Folio, Reservation } from '@/lib/types';

export function FolioCreateModal({
  isOpen,
  onClose,
  reservations,
  reservationsError,
}: {
  isOpen: boolean;
  onClose: () => void;
  reservations: Reservation[];
  reservationsError: unknown | null;
}) {
  const { tenant } = useSession();
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [reservationId, setReservationId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // The original page reset the fields right before opening the modal.
  useEffect(() => {
    if (isOpen) {
      setReservationId('');
      setNotes('');
    }
  }, [isOpen]);

  async function handleCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (reservationId === '') {
      toast({ title: t('folios.toast.reservationRequired'), status: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const folio = await api<Folio>('/api/v1/folios', {
        method: 'POST',
        tenant,
        body: {
          reservationId,
          ...(notes.trim() !== '' ? { notes: notes.trim() } : {}),
          idempotencyKey: `folio-ui-${crypto.randomUUID()}`,
        },
      });
      onClose();
      toast({ title: t('folios.toast.opened', { number: folio.number }), status: 'success' });
      router.push(`/folios/${folio.id}`);
    } catch (cause) {
      toast({
        title: t('folios.toast.openError'),
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={handleCreate}>
        <ModalHeader>{t('folios.modal.title')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Field label={t('folios.field.reservation')} isRequired>
              <Select
                value={reservationId}
                onChange={(event) => setReservationId(event.target.value)}
                placeholder={t('folios.field.reservationPlaceholder')}
              >
                {reservations.map((reservation) => (
                  <option key={reservation.id} value={reservation.id}>
                    {reservation.code} · {reservation.guest.fullName} ·{' '}
                    {reservationStatusLabel(locale, reservation.status)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('folios.field.notes')} helper={t('folios.field.notesHelper')}>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={4000}
                rows={3}
              />
            </Field>
            {reservationsError !== null && (
              <Text color="danger.600" fontSize="sm">
                {errorMessage(reservationsError)}
              </Text>
            )}
            <Badge colorScheme="sky" alignSelf="flex-start">
              {t('folios.activeNotice')}
            </Badge>
          </Stack>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" colorScheme="brand" isLoading={saving}>
            {t('folios.open')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
