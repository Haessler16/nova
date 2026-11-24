'use client';

import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
} from '@chakra-ui/react';
import { GuestNotesPanel } from '@/components/guest-notes-panel';
import { useI18n } from '@/lib/i18n';
import type { Guest } from '@/lib/types';

export function GuestNotesModal({
  guest,
  isOpen,
  onClose,
}: {
  guest: Guest | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {t('guests.notesModal.title', {
            name: guest?.fullName ?? t('guests.notesModal.guestFallback'),
          })}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>{guest !== null && <GuestNotesPanel guestId={guest.id} canManage />}</ModalBody>
      </ModalContent>
    </Modal>
  );
}
