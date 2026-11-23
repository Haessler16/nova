'use client';

import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  Stack,
  useDisclosure,
  type ModalProps,
} from '@chakra-ui/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { DiscardConfirmDialog } from './action-dialog-discard';
import { DialogFooter } from './action-dialog-footer';
import { DialogHeader } from './action-dialog-header';
import { TONE_STYLES, type ActionDialogTone } from './action-dialog-tone';

/**
 * Phase 6 message system: one dialog shell for the decisions reception makes
 * on a stay or an account. The tone selects icon, eyebrow and confirm colour
 * (colour is never the only signal); `summary` carries the consequence in one
 * or two sentences and the operational context goes in `children`.
 *
 * Fixed behaviour, not per-screen configuration:
 * - initial focus lands on the safe action, never on confirm;
 * - Escape, overlay clicks and the close button do not dismiss a `critical`
 *   dialog or any dialog while a request is in flight;
 * - confirm is a submit button, disabled and guarded while loading, so a double
 *   click cannot send two mutations;
 * - the caller passes an already-localized error string, rendered inside the
 *   dialog so the operator keeps context.
 */

export type { ActionDialogTone };

export function ActionDialog({
  isOpen,
  onClose,
  tone = 'info',
  title,
  summary,
  children,
  onConfirm,
  confirmLabel,
  hideCancel = false,
  isLoading = false,
  confirmDisabled = false,
  hasUnsavedChanges = false,
  error,
  size = 'md',
}: {
  isOpen: boolean;
  onClose: () => void;
  tone?: ActionDialogTone;
  title: string;
  summary: string;
  children?: ReactNode;
  onConfirm: () => void;
  confirmLabel: string;
  /** The result of an applied action only needs a close button. */
  hideCancel?: boolean;
  isLoading?: boolean;
  confirmDisabled?: boolean;
  /**
   * When the operator typed something, dismissing asks for confirmation first.
   * The parent still owns the success close and the reset between guests.
   */
  hasUnsavedChanges?: boolean;
  /** Friendly, localized message; the caller owns the mapping from API codes. */
  error?: string;
  size?: ModalProps['size'];
}) {
  const safeActionRef = useRef<HTMLButtonElement>(null);
  const discard = useDisclosure();
  const styles = TONE_STYLES[tone];
  const dismissible = !isLoading && tone !== 'critical';

  // A success close (parent sets isOpen=false) must never leave the discard
  // prompt floating above the page.
  useEffect(() => {
    if (!isOpen) {
      discard.onClose();
    }
  }, [isOpen, discard]);

  function requestClose(): void {
    if (isLoading) {
      return;
    }
    if (hasUnsavedChanges) {
      discard.onOpen();
      return;
    }
    onClose();
  }

  function submit(): void {
    if (isLoading || confirmDisabled) {
      return;
    }
    onConfirm();
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={requestClose}
        size={size}
        isCentered
        scrollBehavior="inside"
        initialFocusRef={safeActionRef}
        closeOnEsc={dismissible}
        closeOnOverlayClick={dismissible}
      >
        <ModalOverlay />
        <ModalContent
          as="form"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <DialogHeader styles={styles} title={title} summary={summary} />
          <ModalCloseButton isDisabled={!dismissible} />
          <ModalBody>
            <Stack spacing={3}>
              {error !== undefined && error !== '' && (
                <Alert
                  status="error"
                  borderRadius="xl"
                  alignItems="flex-start"
                  bg="danger.50"
                  borderWidth="1px"
                  borderColor="danger.100"
                >
                  <AlertIcon color="danger.500" />
                  <Box flex="1">
                    <AlertDescription fontSize="sm">{error}</AlertDescription>
                  </Box>
                </Alert>
              )}
              {children}
            </Stack>
          </ModalBody>
          <DialogFooter
            styles={styles}
            hideCancel={hideCancel}
            isLoading={isLoading}
            confirmDisabled={confirmDisabled}
            confirmLabel={confirmLabel}
            onCancel={requestClose}
            safeActionRef={safeActionRef}
          />
        </ModalContent>
      </Modal>

      <DiscardConfirmDialog
        isOpen={discard.isOpen}
        onClose={discard.onClose}
        onDiscard={() => {
          discard.onClose();
          onClose();
        }}
      />
    </>
  );
}
