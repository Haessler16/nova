'use client';

import { Box, Button, Text, Textarea } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { InstructionSource } from './use-instruction-source';

export function InstructionsSourceSection({
  source,
  canManage,
}: {
  source: InstructionSource;
  canManage: boolean;
}) {
  const { t } = useI18n();

  return (
    <Box>
      <Text fontWeight="semibold">{t('instructions.source.title')}</Text>
      <Text fontSize="xs" color="gray.500" mb={2}>
        {t('instructions.source.body')}
      </Text>
      {canManage ? (
        <Box as="form" onSubmit={(event) => void source.parse(event)}>
          <Textarea
            rows={3}
            value={source.sourceText}
            onChange={(event) => source.setSourceText(event.target.value)}
            placeholder="Ej.: RSV COM CAFE / PGTO DIRETO NO HOTEL (12-15/11) / LUXO CASAL"
          />
          <Button
            mt={2}
            size="sm"
            colorScheme="brand"
            type="submit"
            isLoading={source.parsing}
            isDisabled={source.sourceText.trim().length === 0}
          >
            {t('instructions.source.parse')}
          </Button>
        </Box>
      ) : (
        <Text fontSize="sm" color="gray.500">
          {t('instructions.source.noPermission')}
        </Text>
      )}
    </Box>
  );
}
