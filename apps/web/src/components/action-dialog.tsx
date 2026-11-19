'use client';

import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  Flex,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useDisclosure,
  type ModalProps,
} from '@chakra-ui/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { AlertTriangleIcon, InfoIcon } from './icons';

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

export type ActionDialogTone = 'info' | 'warning' | 'critical';

const TONE_STYLES: Record<
  ActionDialogTone,
  {
    eyebrowKey: TranslationKey;
    iconBg: string;
    iconColor: string;
    confirmScheme: 'brand' | 'warning' | 'danger';
    icon: typeof InfoIcon;
  }
> = {
  info: {
    eyebrowKey: 'actionDialog.tone.info',
    iconBg: 'brand.50',
    iconColor: 'brand.600',
    confirmScheme: 'brand',
    icon: InfoIcon,
  },
  warning: {
    eyebrowKey: 'actionDialog.tone.warning',
    iconBg: 'warning.50',
    iconColor: 'warning.700',
    confirmScheme: 'warning',
    icon: AlertTriangleIcon,
  },
  critical: {
    eyebrowKey: 'actionDialog.tone.critical',
    iconBg: 'danger.50',
    iconColor: 'danger.600',
    confirmScheme: 'danger',
    icon: AlertTriangleIcon,
  },
};

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
  const { t } = useI18n();
  const safeActionRef = useRef<HTMLButtonElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const discard = useDisclosure();
  const styles = TONE_STYLES[tone];
  const Icon = styles.icon;
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
          <ModalHeader>
            <HStack spacing={3} align="flex-start" pr={8}>
              <Flex
                boxSize="38px"
                flexShrink={0}
                align="center"
                justify="center"
                borderRadius="lg"
                bg={styles.iconBg}
                color={styles.iconColor}
                aria-hidden="true"
              >
                <Icon boxSize={5} />
              </Flex>
              <Stack spacing={1} minW={0}>
                <Text
                  fontSize="xs"
                  fontWeight="bold"
                  letterSpacing="0.1em"
                  color={styles.iconColor}
                >
                  {t(styles.eyebrowKey).toUpperCase()}
                </Text>
                <Text fontSize="lg" fontWeight="semibold" lineHeight="1.25">
                  {title}
                </Text>
                <Text fontSize="sm" fontWeight="normal" color="textSecondary">
                  {summary}
                </Text>
              </Stack>
            </HStack>
          </ModalHeader>
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
          <ModalFooter>
            <HStack spacing={3}>
              {!hideCancel && (
                <Button
                  ref={safeActionRef}
                  type="button"
                  variant="ghost"
                  onClick={requestClose}
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
        </ModalContent>
      </Modal>

      <AlertDialog
        isOpen={discard.isOpen}
        onClose={discard.onClose}
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
            <Button ref={keepEditingRef} variant="ghost" onClick={discard.onClose}>
              {t('actionDialog.discard.keepEditing')}
            </Button>
            <Button
              colorScheme="danger"
              ml={3}
              onClick={() => {
                discard.onClose();
                onClose();
              }}
            >
              {t('actionDialog.discard.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
