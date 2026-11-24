'use client';

import { Button, HStack } from '@chakra-ui/react';
import NextLink from 'next/link';
import { ReservationDocuments } from '@/components/documents-panel';
import { PageHeader } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { Folio } from '@/lib/types';

export function FolioHeader({
  folio,
  isOpen,
  hasPayments,
  onCancel,
}: {
  folio: Folio | null;
  isOpen: boolean;
  hasPayments: boolean;
  onCancel: () => void;
}) {
  const { t } = useI18n();

  return (
    <PageHeader
      eyebrow={t('folioDetail.eyebrow')}
      title={folio?.number ?? t('folioDetail.fallback')}
      description={
        folio === null
          ? t('folioDetail.loading')
          : t('folioDetail.description', {
              code: folio.reservationId?.slice(0, 8) ?? '—',
              currency: folio.currencyCode,
            })
      }
      actions={
        <HStack spacing={2} wrap="wrap">
          <Button as={NextLink} href="/folios" variant="outline">
            {t('folioDetail.back')}
          </Button>
          {folio !== null && folio.reservationId !== null && (
            <ReservationDocuments
              reservationId={folio.reservationId}
              reservationCode={folio.reservationId.slice(0, 8)}
            />
          )}
          {folio !== null && isOpen && !hasPayments && (
            <Button colorScheme="danger" variant="outline" onClick={onCancel}>
              {t('folioDetail.cancel')}
            </Button>
          )}
        </HStack>
      }
    />
  );
}
