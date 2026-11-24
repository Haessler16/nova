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
import type { RoomType } from '@/lib/types';
import { hasErrors, validateRoomType, type FieldErrors } from '@/lib/validation';
import {
  EMPTY_FORM,
  buildValidationCopy,
  buildValidationLabels,
  formFromRoomType,
  type RoomTypeForm,
} from '../_lib/room-type-form';
import { RoomTypeFormFields } from './room-type-form-fields';

export function RoomTypeModal({
  isOpen,
  onClose,
  roomType,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  roomType: RoomType | null;
  onSaved: () => void;
}) {
  const { tenant } = useSession();
  const { t } = useI18n();
  const toast = useToast();

  const [form, setForm] = useState<RoomTypeForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  // The original page reset the form right before opening the modal.
  useEffect(() => {
    if (isOpen) {
      setForm(
        roomType === null
          ? EMPTY_FORM
          : formFromRoomType(roomType, roomType.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE'),
      );
      setErrors({});
    }
  }, [isOpen, roomType]);

  const editingId = roomType?.id ?? null;

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const nextErrors = validateRoomType(
      { ...form, codeLocked: editingId !== null },
      { copy: buildValidationCopy(t), labels: buildValidationLabels(t) },
    );
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    try {
      const base = {
        name: form.name.trim(),
        description: form.description.trim() === '' ? undefined : form.description.trim(),
        capacityAdults: Number(form.capacityAdults),
        capacityChildren: Number(form.capacityChildren),
        bedType: form.bedType.trim() === '' ? undefined : form.bedType.trim(),
      };

      if (editingId === null) {
        await api<RoomType>('/api/v1/inventory/room-types', {
          method: 'POST',
          tenant,
          body: { ...base, code: form.code.trim() },
        });
        toast({ title: t('roomTypes.toast.created'), status: 'success' });
      } else {
        await api<RoomType>(`/api/v1/inventory/room-types/${editingId}`, {
          method: 'PATCH',
          tenant,
          body: { ...base, status: form.status },
        });
        toast({ title: t('roomTypes.toast.updated'), status: 'success' });
      }
      onClose();
      onSaved();
    } catch (cause) {
      toast({
        title: t('roomTypes.toast.saveError'),
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
          {editingId === null ? t('roomTypes.createTitle') : t('roomTypes.editTitle')}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <RoomTypeFormFields
            form={form}
            setForm={setForm}
            errors={errors}
            editing={editingId !== null}
          />
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
