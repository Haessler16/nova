'use client';

import { SimpleGrid, Stack, useDisclosure } from '@chakra-ui/react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { QueryFeedback } from '@/components/ui';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import type { Folio, FolioLine, FolioProduct } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { FolioCancelDialog } from './_components/folio-cancel-dialog';
import { FolioChargesPanel } from './_components/folio-charges-panel';
import { FolioHeader } from './_components/folio-header';
import { FolioMetrics } from './_components/folio-metrics';
import { FolioPaymentsPanel } from './_components/folio-payments-panel';
import { FolioVoidDialog } from './_components/folio-void-dialog';
import { useFolioAction } from './_lib/use-folio-action';

function FolioDetailContent() {
  const params = useParams<{ id: string | string[] }>();
  const folioId = Array.isArray(params.id) ? (params.id[0] ?? '') : params.id;
  const { tenant } = useSession();

  const folio = useAsyncData<Folio>(
    () => api<Folio>(`/api/v1/folios/${folioId}`, { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:folio:${folioId}`,
  );

  const products = useAsyncData<{ items: FolioProduct[] }>(
    () => api<{ items: FolioProduct[] }>('/api/v1/products?isActive=true', { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:folio-products`,
  );

  const voidModal = useDisclosure();
  const cancelModal = useDisclosure();
  const [voidTarget, setVoidTarget] = useState<FolioLine | null>(null);

  const action = useFolioAction(() => folio.reload());

  const data = folio.data;
  const isOpen = data?.status === 'OPEN';
  const catalog = products.data?.items ?? [];
  const hasPayments = (data?.payments.length ?? 0) > 0;

  function openVoid(line: FolioLine): void {
    setVoidTarget(line);
    voidModal.onOpen();
  }

  return (
    <>
      <FolioHeader
        folio={data}
        isOpen={isOpen}
        hasPayments={hasPayments}
        onCancel={cancelModal.onOpen}
      />

      <QueryFeedback loading={folio.loading} error={folio.error} onRetry={folio.reload}>
        {data !== null && (
          <Stack spacing={5}>
            <FolioMetrics folio={data} />

            <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={5} alignItems="start">
              <FolioChargesPanel
                folio={data}
                folioId={folioId}
                catalog={catalog}
                action={action}
                onVoid={openVoid}
              />
              <FolioPaymentsPanel folio={data} folioId={folioId} action={action} />
            </SimpleGrid>
          </Stack>
        )}
      </QueryFeedback>

      <FolioVoidDialog
        folioId={folioId}
        target={voidTarget}
        currency={data?.currencyCode}
        isOpen={voidModal.isOpen}
        onClose={voidModal.onClose}
        action={action}
      />

      <FolioCancelDialog
        folioId={folioId}
        isOpen={cancelModal.isOpen}
        onClose={cancelModal.onClose}
        action={action}
      />
    </>
  );
}

export default function FolioDetailPage() {
  return (
    <PropertyGate>
      <FolioDetailContent />
    </PropertyGate>
  );
}
