'use client';

import { Button, HStack } from '@chakra-ui/react';
import { DownloadIcon } from '@/components/icons';
import { PageHeader } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

export function ReservationsHeader({
  exporting,
  onExport,
  onNew,
}: {
  exporting: boolean;
  onExport: () => void;
  onNew: () => void;
}) {
  const { t } = useI18n();
  return (
    <PageHeader
      title={t('reservations.title')}
      description={t('reservations.description')}
      actions={
        <HStack spacing={2}>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<DownloadIcon boxSize={4} />}
            onClick={onExport}
            isLoading={exporting}
          >
            {t('reservations.export')}
          </Button>
          <Button colorScheme="brand" size="sm" onClick={onNew}>
            {t('reservations.new')}
          </Button>
        </HStack>
      }
    />
  );
}
