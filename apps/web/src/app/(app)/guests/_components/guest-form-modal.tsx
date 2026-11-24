'use client';

import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useToast,
} from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Guest } from '@/lib/types';
import { hasErrors, validateGuest, type FieldErrors } from '@/lib/validation';
import { guestFieldLabels, validationCopy } from '../../reservations/_lib/reservation-labels';
import { EMPTY_FORM, formFromGuest, type GuestForm } from '../_lib/guest-form';
import { GuestFormFields } from './guest-form-fields';

export function GuestFormModal({
  isOpen,
  onClose,
  guest,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  guest: Guest | null;
  onSaved: () => void;
}) {
  const { tenant } = useSession();
  const { t } = useI18n();
  const toast = useToast();

  const [form, setForm] = useState<GuestForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  // The original page reset the form right before opening the modal.
  useEffect(() => {
    if (isOpen) {
      setForm(guest === null ? EMPTY_FORM : formFromGuest(guest));
      setErrors({});
    }
  }, [isOpen, guest]);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const nextErrors = validateGuest(form, {
      copy: validationCopy(t),
      labels: guestFieldLabels(t),
    });
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    try {
      const documentPayload =
        form.documentType === ''
          ? { documentType: null, documentNumber: null }
          : { documentType: form.documentType, documentNumber: form.documentNumber.trim() };

      const body = {
        fullName: form.fullName.trim(),
        email: form.email.trim() === '' ? undefined : form.email.trim(),
        phone: form.phone.trim() === '' ? undefined : form.phone.trim(),
        notes: form.notes.trim() === '' ? undefined : form.notes.trim(),
        ...documentPayload,
      };

      if (guest === null) {
        await api<Guest>('/api/v1/guests', {
          method: 'POST',
          tenant,
          body: {
            fullName: body.fullName,
            ...(body.email !== undefined ? { email: body.email } : {}),
            ...(body.phone !== undefined ? { phone: body.phone } : {}),
            ...(body.notes !== undefined ? { notes: body.notes } : {}),
            ...(body.documentType !== null
              ? { documentType: body.documentType, documentNumber: body.documentNumber }
              : {}),
          },
        });
        toast({ title: t('guests.toast.created'), status: 'success' });
      } else {
        await api<Guest>(`/api/v1/guests/${guest.id}`, { method: 'PATCH', tenant, body });
        toast({ title: t('guests.toast.updated'), status: 'success' });
      }
      onClose();
      onSaved();
    } catch (cause) {
      toast({
        title: t('guests.toast.saveError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={(event) => void handleSubmit(event)}>
        <ModalHeader>
          {guest === null ? t('guests.modal.create') : t('guests.modal.edit')}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <GuestFormFields form={form} setForm={setForm} errors={errors} />
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" colorScheme="brand" isLoading={saving}>
            {t('common.save')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
