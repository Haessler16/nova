'use client';

import { Box, Button, Divider, HStack, Select, Stack, Text } from '@chakra-ui/react';
import { formatCalendarDate, reservationDocumentLabel, reservationStatusLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { DocumentType, Reservation } from '@/lib/types';
import { DocumentHistoryPanel } from './document-history-panel';
import { DOCUMENT_TYPES } from './document-types';
import type { DocumentsActions } from './use-documents-actions';
import type { DocumentsState } from './use-documents-state';

export function DocumentGenerationPanel({
  state,
  actions,
  reservations,
}: {
  state: DocumentsState;
  actions: DocumentsActions;
  reservations: Reservation[] | undefined;
}) {
  const { t, locale } = useI18n();

  return (
    <Stack spacing={4}>
      {reservations !== undefined && reservations.length > 1 && (
        <DocumentOriginSelect state={state} reservations={reservations} />
      )}

      <Box>
        <Text fontWeight="semibold" mb={2}>
          {t('documents.new')}
        </Text>
        <Text fontSize="sm" color="gray.600" mb={3}>
          {t('documents.newHint')}
        </Text>
        <Stack spacing={3}>
          <Box>
            <Text fontSize="xs" color="gray.500" mb={1}>
              {t('documents.typeLabel')}
            </Text>
            <Select
              value={state.type}
              onChange={(event) => state.changeType(event.target.value as DocumentType)}
            >
              {DOCUMENT_TYPES.map((item) => (
                <option key={item} value={item}>
                  {reservationDocumentLabel(locale, item)}
                </option>
              ))}
            </Select>
          </Box>
          <Box>
            <Text fontSize="xs" color="gray.500" mb={1}>
              {t('documents.templateLabel')}
            </Text>
            <Select
              value={state.activeTemplate?.id ?? ''}
              onChange={(event) => {
                state.setTemplateId(event.target.value);
                state.setPreview(null);
              }}
              isDisabled={state.availableTemplates.length === 0}
            >
              {state.availableTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} · v{template.version} · {template.locale}
                </option>
              ))}
            </Select>
            {state.availableTemplates.length === 0 && (
              <Text fontSize="xs" color="warning.600" mt={1}>
                {t('documents.noTemplate')}
              </Text>
            )}
          </Box>
          <HStack>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void actions.handlePreview()}
              isLoading={actions.previewing}
              isDisabled={state.activeTemplate === null}
            >
              {t('documents.preview')}
            </Button>
            <Button
              size="sm"
              colorScheme="brand"
              onClick={() => void actions.handleGenerate()}
              isLoading={actions.generating}
              isDisabled={state.activeTemplate === null || state.preview === null}
            >
              {t('documents.generate')}
            </Button>
          </HStack>
          {state.preview === null && state.activeTemplate !== null && (
            <Text fontSize="xs" color="gray.500">
              {t('documents.previewFirst')}
            </Text>
          )}
          {state.activeTemplate?.signatureRequired === true && (
            <Text fontSize="xs" color="gray.500">
              {t('documents.signatureHint')}
            </Text>
          )}
        </Stack>
      </Box>

      <Divider />

      <DocumentHistoryPanel state={state} actions={actions} />
    </Stack>
  );
}

function DocumentOriginSelect({
  state,
  reservations,
}: {
  state: DocumentsState;
  reservations: Reservation[];
}) {
  const { t, locale } = useI18n();

  return (
    <Box>
      <Text fontSize="xs" color="gray.500" mb={1}>
        {t('documents.origin')}
      </Text>
      <Select
        aria-label={t('documents.origin')}
        value={state.activeReservationId}
        onChange={(event) => state.changeReservation(event.target.value)}
      >
        {reservations.map((reservation) => (
          <option key={reservation.id} value={reservation.id}>
            {reservation.code} · {formatCalendarDate(reservation.checkInDate)} →{' '}
            {formatCalendarDate(reservation.checkOutDate)} ·{' '}
            {reservationStatusLabel(locale, reservation.status)}
          </option>
        ))}
      </Select>
      <Text fontSize="xs" color="gray.500" mt={1}>
        {t('documents.originHelper')}
      </Text>
    </Box>
  );
}
