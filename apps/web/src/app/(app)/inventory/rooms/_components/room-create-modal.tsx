'use client';

import {
  Button,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
} from '@chakra-ui/react';
import { Field } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { RoomType } from '@/lib/types';
import type { FieldErrors } from '@/lib/validation';
import type { FormEvent } from 'react';
import type { RoomForm } from '../_lib/rooms';

export function RoomCreateModal({
  isOpen,
  onClose,
  form,
  onChange,
  errors,
  saving,
  onSubmit,
  roomTypes,
}: {
  isOpen: boolean;
  onClose: () => void;
  form: RoomForm;
  onChange: (form: RoomForm) => void;
  errors: FieldErrors;
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
  roomTypes: RoomType[] | undefined;
}) {
  const { t } = useI18n();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={onSubmit}>
        <ModalHeader>{t('rooms.create.title')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Field
              label={t('rooms.form.number')}
              isRequired
              helper={t('rooms.form.numberHelper')}
              error={errors.number}
            >
              <Input
                value={form.number}
                onChange={(event) => onChange({ ...form, number: event.target.value })}
                required
                maxLength={32}
              />
            </Field>
            <Field label={t('rooms.form.roomType')} isRequired error={errors.roomTypeId}>
              <Select
                value={form.roomTypeId}
                onChange={(event) => onChange({ ...form, roomTypeId: event.target.value })}
                required
              >
                <option value="">{t('rooms.form.select')}</option>
                {roomTypes?.map((roomType) => (
                  <option key={roomType.id} value={roomType.id}>
                    {t('rooms.form.roomTypeOption', {
                      name: roomType.name,
                      count: roomType.capacityAdults,
                    })}
                  </option>
                ))}
              </Select>
            </Field>
            <HStack spacing={4} align="flex-start">
              <Field label={t('rooms.form.floor')} error={errors.floor}>
                <Input
                  value={form.floor}
                  maxLength={32}
                  onChange={(event) => onChange({ ...form, floor: event.target.value })}
                />
              </Field>
              <Field label={t('rooms.form.building')} error={errors.building}>
                <Input
                  value={form.building}
                  maxLength={64}
                  onChange={(event) => onChange({ ...form, building: event.target.value })}
                />
              </Field>
            </HStack>
            <Field
              label={t('rooms.form.attributes')}
              error={errors.attributes}
              helper={t('rooms.form.attributesHelperCreate')}
            >
              <Input
                value={form.attributes}
                onChange={(event) => onChange({ ...form, attributes: event.target.value })}
              />
            </Field>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            {t('rooms.form.cancel')}
          </Button>
          <Button type="submit" colorScheme="brand" isLoading={saving}>
            {t('rooms.form.create')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
