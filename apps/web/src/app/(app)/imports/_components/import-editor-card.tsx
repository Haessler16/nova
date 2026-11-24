'use client';

import { Button, HStack, Input, Stack, Text, Textarea } from '@chakra-ui/react';
import type { ChangeEvent } from 'react';
import { SectionCard } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

export const CSV_TEMPLATE = [
  'fullName,email,phone,documentType,documentNumber,notes',
  'Ana Silva,ana.silva@example.test,+55 11 90000-0000,PASSPORT,AB123456,Cliente sintético',
].join('\n');

export function ImportEditorCard({
  tenantKey,
  csv,
  busy,
  canPreview,
  canCommit,
  onChangeCsv,
  onFile,
  onPreview,
  onCommit,
}: {
  tenantKey: string;
  csv: string;
  busy: 'preview' | 'commit' | null;
  canPreview: boolean;
  canCommit: boolean;
  onChangeCsv: (csv: string) => void;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onPreview: () => void;
  onCommit: () => void;
}) {
  const { t } = useI18n();

  return (
    <SectionCard>
      <Stack spacing={4}>
        <HStack justify="space-between" wrap="wrap" spacing={2}>
          <Text fontSize="sm" color="gray.600">
            {t('imports.editor.columns')}
          </Text>
          <Button size="xs" variant="ghost" onClick={() => onChangeCsv(CSV_TEMPLATE)}>
            {t('imports.editor.useTemplate')}
          </Button>
        </HStack>

        <Input
          type="file"
          accept=".csv,text/csv"
          size="sm"
          aria-label={t('imports.editor.fileLabel')}
          onChange={onFile}
        />

        <Textarea
          value={csv}
          onChange={(event) => onChangeCsv(event.target.value)}
          rows={8}
          fontFamily="mono"
          fontSize="sm"
          placeholder={CSV_TEMPLATE}
          aria-label={t('imports.editor.contentLabel')}
        />

        <HStack>
          <Button
            size="sm"
            colorScheme="brand"
            onClick={onPreview}
            isDisabled={!canPreview}
            isLoading={busy === 'preview'}
          >
            {t('imports.editor.preview')}
          </Button>
          <Button
            size="sm"
            colorScheme="green"
            onClick={onCommit}
            isDisabled={!canCommit}
            isLoading={busy === 'commit'}
          >
            {t('imports.editor.commit')}
          </Button>
          <Text fontSize="xs" color="gray.500">
            {t('imports.editor.tenantKey', { key: tenantKey })}
          </Text>
        </HStack>
      </Stack>
    </SectionCard>
  );
}
