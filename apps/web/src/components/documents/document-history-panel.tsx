'use client';

import { Badge, Box, Button, HStack, Stack, Text } from '@chakra-ui/react';
import {
  DOCUMENT_STATUS_COLORS,
  documentStatusLabel,
  formatDateTime,
  reservationDocumentLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { DocumentsActions } from './use-documents-actions';
import type { DocumentsState } from './use-documents-state';

export function DocumentHistoryPanel({
  state,
  actions,
}: {
  state: DocumentsState;
  actions: DocumentsActions;
}) {
  const { t, locale } = useI18n();

  return (
    <Box>
      <HStack justify="space-between" mb={2}>
        <Text fontWeight="semibold">{t('documents.history')}</Text>
        <Text fontSize="xs" color="gray.500">
          {t('documents.historyCount', { count: state.history.length })}
        </Text>
      </HStack>
      {state.history.length === 0 ? (
        <Text fontSize="sm" color="gray.500">
          {t('documents.historyEmpty')}
        </Text>
      ) : (
        <Stack spacing={2} maxH="340px" overflowY="auto" pr={1}>
          {state.history.map((document) => (
            <Box
              key={document.id}
              borderWidth="1px"
              borderColor={state.selected?.id === document.id ? 'brand.300' : 'gray.200'}
              rounded="md"
              p={3}
              bg={state.selected?.id === document.id ? 'brand.50' : 'white'}
            >
              <HStack justify="space-between" align="start">
                <Box>
                  <Text fontSize="sm" fontWeight="medium">
                    {reservationDocumentLabel(locale, document.documentType)}
                  </Text>
                  <Text fontSize="xs" color="gray.500" fontFamily="mono">
                    {document.number}
                  </Text>
                </Box>
                <Badge colorScheme={DOCUMENT_STATUS_COLORS[document.status]}>
                  {documentStatusLabel(locale, document.status)}
                </Badge>
              </HStack>
              <Text fontSize="xs" color="gray.500" mt={1}>
                {formatDateTime(document.generatedAt)} · v{document.templateVersion} ·{' '}
                {t('documents.pages', { count: document.pageCount })}
              </Text>
              <HStack mt={2} spacing={2} wrap="wrap">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => void actions.handleOpen(document)}
                  isLoading={actions.workingId === document.id}
                >
                  {t('documents.open')}
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => void actions.handleDownload(document)}
                  isDisabled={actions.workingId === document.id}
                >
                  {t('documents.download')}
                </Button>
                {document.status === 'GENERATED' && (
                  <Button
                    size="xs"
                    variant="ghost"
                    colorScheme="mint"
                    onClick={() => void actions.handleSignature(document)}
                    isDisabled={actions.workingId === document.id}
                  >
                    {t('documents.signature')}
                  </Button>
                )}
              </HStack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
