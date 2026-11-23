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
  Stack,
  Text,
} from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { GuestEditController } from '../_hooks/use-guest-edit';
import { GuestFields } from './guest-fields';

export function GuestEditModal({ edit }: { edit: GuestEditController }) {
  const { t } = useI18n();
  return (
    <Modal isOpen={edit.modal.isOpen} onClose={edit.modal.onClose} size="lg">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={(event) => void edit.submit(event)}>
        <ModalHeader>{t('reservations.guestEdit.title')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={3}>
            <Text fontSize="sm" color="textSecondary">
              {t('reservations.guestEdit.body')}
            </Text>
            <GuestFields
              value={edit.form}
              onChange={(patch) => edit.setForm((current) => ({ ...current, ...patch }))}
              disabled={edit.saving}
              idPrefix="edit-reservation-guest"
              errors={edit.errors}
            />
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={edit.modal.onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" colorScheme="brand" isLoading={edit.saving}>
            {t('reservations.guestEdit.submit')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
