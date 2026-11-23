'use client';

import { Alert, AlertDescription, AlertIcon, Button } from '@chakra-ui/react';
import NextLink from 'next/link';
import { SectionCard } from '@/components/ui';
import type { GuestImportResult } from '@/lib/guest-import-types';

export function ImportResultCard({ result }: { result: GuestImportResult }) {
  return (
    <SectionCard>
      <Alert status={result.replayed ? 'info' : 'success'} borderRadius="md">
        <AlertIcon />
        <AlertDescription>
          {result.replayed
            ? 'Esta importación ya se había confirmado con la misma clave; no se crearon duplicados.'
            : `Se crearon ${result.createdCount} huéspedes.`}{' '}
          Importación <code>{result.importId}</code>.{' '}
          <Button as={NextLink} href="/guests" size="xs" variant="link">
            Revisar huéspedes
          </Button>
        </AlertDescription>
      </Alert>
    </SectionCard>
  );
}
