'use client';

import { Button, HStack, Stack, useDisclosure } from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { ErrorAlert, PageHeader, QueryFeedback, SectionCard } from '@/components/ui';
import { useSession } from '@/context/session';
import { useI18n } from '@/lib/i18n';
import { useAuditFeedStore } from '@/stores/audit-feed';
import type { AuditEvent } from '@/lib/types';
import { EMPTY_FILTERS, type AuditFilters } from './audit-filters';
import { AuditEventModal } from './_components/audit-event-modal';
import { AuditEventsTable } from './_components/audit-events-table';
import { AuditFilterBar } from './_components/audit-filter-bar';

function AuditContent() {
  const { tenant } = useSession();
  const { t } = useI18n();
  const organizationId = tenant.organizationId;
  const propertyId = tenant.propertyId;
  const metadataModal = useDisclosure();

  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [inputs, setInputs] = useState<AuditFilters>(EMPTY_FILTERS);

  const tenantKey = `${organizationId}:${propertyId}`;
  const filters = useAuditFeedStore((state) => state.filters);
  const feedTenantKey = useAuditFeedStore((state) => state.tenantKey);
  const storedItems = useAuditFeedStore((state) => state.items);
  const storedNextCursor = useAuditFeedStore((state) => state.nextCursor);
  const storedLoading = useAuditFeedStore((state) => state.loading);
  const storedLoadingMore = useAuditFeedStore((state) => state.loadingMore);
  const storedError = useAuditFeedStore((state) => state.error);
  const storedMoreError = useAuditFeedStore((state) => state.moreError);
  const load = useAuditFeedStore((state) => state.load);
  const loadMore = useAuditFeedStore((state) => state.loadMore);
  const setFilters = useAuditFeedStore((state) => state.setFilters);

  // Never render the previous property's feed while the new load starts.
  const tenantMatches = feedTenantKey === tenantKey;
  const items = tenantMatches ? storedItems : [];
  const nextCursor = tenantMatches ? storedNextCursor : null;
  const loading = tenantMatches ? storedLoading : true;
  const loadingMore = tenantMatches ? storedLoadingMore : false;
  const error = tenantMatches ? storedError : null;
  const moreError = tenantMatches ? storedMoreError : null;

  useEffect(() => {
    void load({
      tenantKey,
      tenant: { organizationId, propertyId },
      filters,
    });
  }, [load, tenantKey, organizationId, propertyId, filters]);

  function applyFilters(event: FormEvent): void {
    event.preventDefault();
    setFilters({ ...inputs });
  }

  function resetFilters(): void {
    setInputs({ ...EMPTY_FILTERS });
    setFilters({ ...EMPTY_FILTERS });
  }

  function openDetail(event: AuditEvent): void {
    setSelected(event);
    metadataModal.onOpen();
  }

  return (
    <>
      <PageHeader title={t('audit.title')} description={t('audit.description')} />

      <SectionCard>
        <AuditFilterBar
          inputs={inputs}
          total={items.length}
          onChange={setInputs}
          onSubmit={applyFilters}
          onReset={resetFilters}
        />

        <QueryFeedback
          loading={loading}
          error={error}
          onRetry={() => void load({ tenantKey, tenant: { organizationId, propertyId }, filters })}
          isEmpty={items.length === 0}
          emptyText={t('audit.empty')}
        >
          <AuditEventsTable items={items} onSelect={openDetail} />

          {moreError !== null && (
            <Stack mt={3}>
              <ErrorAlert error={moreError} />
            </Stack>
          )}

          {nextCursor !== null && (
            <HStack justify="center" mt={4}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void loadMore({ organizationId, propertyId })}
                isLoading={loadingMore}
              >
                {t('audit.loadMore')}
              </Button>
            </HStack>
          )}
        </QueryFeedback>
      </SectionCard>

      <AuditEventModal
        isOpen={metadataModal.isOpen}
        onClose={metadataModal.onClose}
        event={selected}
      />
    </>
  );
}

export default function AuditPage() {
  return (
    <PropertyGate>
      <AuditContent />
    </PropertyGate>
  );
}
