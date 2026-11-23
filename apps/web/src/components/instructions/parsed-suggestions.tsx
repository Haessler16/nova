'use client';

import { Badge, Box, Button, Checkbox, HStack, Stack, Text } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { InstructionSource } from './use-instruction-source';

export function ParsedSuggestions({ source }: { source: InstructionSource }) {
  const { t } = useI18n();
  const parsed = source.parsed;

  if (parsed === null) {
    return null;
  }

  return (
    <Box borderWidth="1px" borderColor="brand.200" borderRadius="md" p={3} mt={3}>
      <HStack justify="space-between">
        <Text fontWeight="semibold">{t('instructions.parsed.title')}</Text>
        <Badge colorScheme="brand">{parsed.suggestions.length}</Badge>
      </HStack>
      {parsed.redacted && (
        <Text fontSize="xs" color="warning.600" mt={1}>
          {t('instructions.parsed.redacted')}
        </Text>
      )}
      {parsed.warnings.map((warning) => (
        <Text key={warning} fontSize="xs" color="gray.600" mt={1}>
          · {warning}
        </Text>
      ))}
      <Stack spacing={2} mt={3}>
        {parsed.suggestions.map((suggestion, index) => (
          <Box key={`${suggestion.title}:${index}`} borderTopWidth="1px" pt={2}>
            <Checkbox
              isChecked={source.selected.has(index)}
              onChange={(event) => source.toggleSuggestion(index, event.target.checked)}
            >
              <Text as="span" fontWeight="semibold">
                {suggestion.title}
              </Text>
            </Checkbox>
            <Text fontSize="xs" color="gray.600" mt={1}>
              {suggestion.body}
            </Text>
            <Text fontSize="xs" color="gray.400">
              {t('instructions.parsed.confidence', {
                phrase: suggestion.sourcePhrase,
                percent: Math.round(suggestion.confidence * 100),
              })}
            </Text>
          </Box>
        ))}
      </Stack>
      <HStack mt={3} spacing={2}>
        <Button
          size="sm"
          colorScheme="brand"
          isLoading={source.confirming}
          isDisabled={source.selected.size === 0}
          onClick={() => void source.confirm()}
        >
          {t('instructions.parsed.confirm')}
        </Button>
        <Button size="sm" variant="ghost" onClick={source.clearParsed}>
          {t('common.cancel')}
        </Button>
      </HStack>
    </Box>
  );
}
