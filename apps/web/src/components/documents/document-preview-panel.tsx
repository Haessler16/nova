'use client';

import { Box, HStack, Text } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { DocumentsState } from './use-documents-state';

export function DocumentPreviewPanel({ state }: { state: DocumentsState }) {
  const { t } = useI18n();

  return (
    <Box>
      <HStack justify="space-between" mb={2}>
        <Text fontWeight="semibold">{t('documents.previewTitle')}</Text>
        {state.preview !== null && (
          <Text fontSize="xs" color="gray.500">
            {state.preview.template.name} · v{state.preview.template.version}
          </Text>
        )}
      </HStack>
      {state.preview === null ? (
        <Box
          borderWidth="1px"
          borderStyle="dashed"
          borderColor="gray.300"
          rounded="md"
          minH={{ base: '320px', lg: '560px' }}
          display="flex"
          alignItems="center"
          justifyContent="center"
          p={6}
        >
          <Text fontSize="sm" color="gray.500" textAlign="center">
            {t('documents.previewEmpty')}
          </Text>
        </Box>
      ) : (
        <Box
          as="iframe"
          title={t('documents.previewIframe')}
          srcDoc={state.preview.html}
          sandbox=""
          w="100%"
          h={{ base: '420px', lg: '620px' }}
          borderWidth="1px"
          borderColor="gray.200"
          rounded="md"
          bg="white"
        />
      )}
      {state.selected !== null && (
        <Text fontSize="xs" color="gray.500" mt={2}>
          {t('documents.lastGenerated', {
            number: state.selected.number,
            hash: state.selected.sha256.slice(0, 12),
          })}
        </Text>
      )}
    </Box>
  );
}
