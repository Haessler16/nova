'use client';

import { Alert, AlertDescription, AlertIcon, Button } from '@chakra-ui/react';
import NextLink from 'next/link';
import { SectionCard } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { GuestImportResult } from '@/lib/guest-import-types';

export function ImportResultCard({ result }: { result: GuestImportResult }) {
  const { t } = useI18n();

  return (
    <SectionCard>
      <Alert status={result.replayed ? 'info' : 'success'} borderRadius="md">
        <AlertIcon />
        <AlertDescription>
          {result.replayed
            ? t('imports.result.replayed')
            : t('imports.result.created', { count: result.createdCount })}{' '}
          {t('imports.result.importId', { id: result.importId })}{' '}
          <Button as={NextLink} href="/guests" size="xs" variant="link">
            {t('imports.result.review')}
          </Button>
        </AlertDescription>
      </Alert>
    </SectionCard>
  );
}
