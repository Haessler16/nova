'use client';

import { Button, useDisclosure, useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { PageHeader, SectionCard } from '@/components/ui';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { FolioProduct } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { CatalogFilterBar, type CatalogFilters } from './_components/catalog-filter-bar';
import { CatalogTable } from './_components/catalog-table';
import { ProductModal } from './_components/product-modal';

interface ProductList {
  items: FolioProduct[];
}

function CatalogContent() {
  const { tenant } = useSession();
  const { t } = useI18n();
  const toast = useToast();
  const modal = useDisclosure();

  const [filters, setFilters] = useState<CatalogFilters>({
    search: '',
    category: '',
    isActive: 'true',
  });
  const [editing, setEditing] = useState<FolioProduct | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const products = useAsyncData<ProductList>(
    () => {
      const params = new URLSearchParams();
      if (filters.search.trim() !== '') params.set('search', filters.search.trim());
      if (filters.category !== '') params.set('category', filters.category);
      if (filters.isActive !== '') params.set('isActive', filters.isActive);
      return api<ProductList>(`/api/v1/products?${params.toString()}`, { tenant });
    },
    `${tenant.organizationId}:${tenant.propertyId}:catalog:${JSON.stringify(filters)}`,
  );

  function openCreate(): void {
    setEditing(null);
    modal.onOpen();
  }

  function openEdit(product: FolioProduct): void {
    setEditing(product);
    modal.onOpen();
  }

  async function toggleActive(product: FolioProduct): Promise<void> {
    setBusy(`toggle:${product.id}`);
    try {
      await api<FolioProduct>(`/api/v1/products/${product.id}`, {
        method: 'PATCH',
        tenant,
        body: { isActive: !product.isActive },
      });
      toast({
        title: product.isActive ? t('catalog.toast.deactivated') : t('catalog.toast.activated'),
        status: 'success',
      });
      products.reload();
    } catch (cause) {
      toast({
        title: t('catalog.toast.statusError'),
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={t('catalog.eyebrow')}
        title={t('catalog.title')}
        description={t('catalog.description')}
        actions={
          <Button colorScheme="brand" onClick={openCreate}>
            {t('catalog.create')}
          </Button>
        }
      />

      <CatalogFilterBar filters={filters} onChange={setFilters} />

      <SectionCard>
        <CatalogTable
          items={products.data?.items ?? []}
          loading={products.loading}
          error={products.error}
          onRetry={products.reload}
          busy={busy}
          onEdit={openEdit}
          onToggle={(product) => void toggleActive(product)}
        />
      </SectionCard>

      <ProductModal
        isOpen={modal.isOpen}
        onClose={modal.onClose}
        editing={editing}
        onSaved={products.reload}
      />
    </>
  );
}

export default function CatalogPage() {
  return (
    <PropertyGate>
      <CatalogContent />
    </PropertyGate>
  );
}
