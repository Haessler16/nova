'use client';

import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
} from '@chakra-ui/react';
import { useRef } from 'react';
import { useI18n } from '@/lib/i18n';

export function DiscardConfirmDialog({
  isOpen,
  onClose,
  onDiscard,
}: {
  isOpen: boolean;
  onClose: () => void;
  onDiscard: () => void;
}) {
  const { t } = useI18n();
  const keepEditingRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog
      isOpen={isOpen}
      onClose={onClose}
      leastDestructiveRef={keepEditingRef}
      isCentered
      size="sm"
    >
      <AlertDialogOverlay />
      <AlertDialogContent>
        <AlertDialogHeader fontSize="md" fontWeight="semibold">
          {t('actionDialog.discard.title')}
        </AlertDialogHeader>
        <AlertDialogBody fontSize="sm">{t('actionDialog.discard.body')}</AlertDialogBody>
        <AlertDialogFooter>
          <Button ref={keepEditingRef} variant="ghost" onClick={onClose}>
            {t('actionDialog.discard.keepEditing')}
          </Button>
          <Button colorScheme="danger" ml={3} onClick={onDiscard}>
            {t('actionDialog.discard.confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
