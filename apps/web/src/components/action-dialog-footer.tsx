'use client';

import { Button, HStack, ModalFooter } from '@chakra-ui/react';
import type { Ref } from 'react';
import { useI18n } from '@/lib/i18n';
import type { ActionDialogToneStyles } from './action-dialog-tone';

export function DialogFooter({
  styles,
  hideCancel,
  isLoading,
  confirmDisabled,
  confirmLabel,
  onCancel,
  safeActionRef,
}: {
  styles: ActionDialogToneStyles;
  hideCancel: boolean;
  isLoading: boolean;
  confirmDisabled: boolean;
  confirmLabel: string;
  onCancel: () => void;
  safeActionRef: Ref<HTMLButtonElement>;
}) {
  const { t } = useI18n();

  return (
    <ModalFooter>
      <HStack spacing={3}>
        {!hideCancel && (
          <Button
            ref={safeActionRef}
            type="button"
            variant="ghost"
            onClick={onCancel}
            isDisabled={isLoading}
          >
            {t('actionDialog.cancel')}
          </Button>
        )}
        <Button
          ref={hideCancel ? safeActionRef : undefined}
          type="submit"
          colorScheme={styles.confirmScheme}
          isLoading={isLoading}
          isDisabled={confirmDisabled}
        >
          {confirmLabel}
        </Button>
      </HStack>
    </ModalFooter>
  );
}
