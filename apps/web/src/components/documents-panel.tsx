'use client';

import {
  Box,
  Button,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Spinner,
  Text,
} from '@chakra-ui/react';
import { errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Reservation } from '@/lib/types';
import { DocumentGenerationPanel } from './documents/document-generation-panel';
import { DocumentPreviewPanel } from './documents/document-preview-panel';
import { useDocumentsActions } from './documents/use-documents-actions';
import { useDocumentsState } from './documents/use-documents-state';

interface ReservationDocumentsProps {
  reservationId: string;
  reservationCode: string;
  /** Optional eligible reservations for a guest-level entry point. */
  reservations?: Reservation[];
  hideTrigger?: boolean;
  defaultOpen?: boolean;
  onClose?: () => void;
}

export function ReservationDocuments({
  reservationId,
  reservationCode,
  reservations,
  hideTrigger = false,
  defaultOpen = false,
  onClose,
}: ReservationDocumentsProps) {
  const { t } = useI18n();
  const state = useDocumentsState({ reservationId, reservations, defaultOpen });
  const actions = useDocumentsActions(state, reservationId);
  const activeReservationCode = state.activeReservation?.code ?? reservationCode;

  function closeModal(): void {
    state.modal.onClose();
    onClose?.();
  }

  return (
    <>
      {!hideTrigger && (
        <Button size="xs" variant="outline" onClick={state.modal.onOpen}>
          {t('documents.trigger')}
        </Button>
      )}

      <Modal isOpen={state.modal.isOpen} onClose={closeModal} size="6xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent maxW="1180px">
          <ModalHeader>
            {t('documents.title', { code: activeReservationCode })}
            <Text fontSize="sm" fontWeight="normal" color="gray.500">
              {t('documents.subtitle')}
            </Text>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {state.error !== null && (
              <Box
                mb={4}
                borderWidth="1px"
                borderColor="danger.200"
                bg="danger.50"
                p={3}
                rounded="md"
              >
                <Text fontSize="sm" color="danger.700">
                  {errorMessage(state.error)}
                </Text>
              </Box>
            )}

            {state.loading ? (
              <HStack justify="center" py={10}>
                <Spinner size="sm" />
                <Text fontSize="sm" color="gray.500">
                  {t('documents.loading')}
                </Text>
              </HStack>
            ) : (
              <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
                <DocumentGenerationPanel
                  state={state}
                  actions={actions}
                  reservations={reservations}
                />
                <DocumentPreviewPanel state={state} />
              </SimpleGrid>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={closeModal}>
              {t('documents.close')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
