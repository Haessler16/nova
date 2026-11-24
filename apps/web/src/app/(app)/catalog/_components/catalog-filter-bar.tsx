'use client';

import { HStack, Input, Select } from '@chakra-ui/react';
import { Field, SectionCard } from '@/components/ui';
import { productCategoryLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { CATEGORIES } from '../_lib/product-form';

export interface CatalogFilters {
  search: string;
  category: string;
  isActive: string;
}

export function CatalogFilterBar({
  filters,
  onChange,
}: {
  filters: CatalogFilters;
  onChange: (updater: (current: CatalogFilters) => CatalogFilters) => void;
}) {
  const { t, locale } = useI18n();

  return (
    <SectionCard mb={5}>
      <HStack spacing={3} wrap="wrap" align="flex-end">
        <Field label={t('catalog.filter.search')}>
          <Input
            size="sm"
            placeholder={t('catalog.filter.searchPlaceholder')}
            value={filters.search}
            onChange={(event) =>
              onChange((current) => ({ ...current, search: event.target.value }))
            }
          />
        </Field>
        <Field label={t('catalog.filter.category')}>
          <Select
            size="sm"
            value={filters.category}
            onChange={(event) =>
              onChange((current) => ({ ...current, category: event.target.value }))
            }
          >
            <option value="">{t('catalog.filter.allCategories')}</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {productCategoryLabel(locale, category)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('catalog.filter.status')}>
          <Select
            size="sm"
            value={filters.isActive}
            onChange={(event) =>
              onChange((current) => ({ ...current, isActive: event.target.value }))
            }
          >
            <option value="true">{t('catalog.filter.active')}</option>
            <option value="false">{t('catalog.filter.inactive')}</option>
            <option value="">{t('catalog.filter.allStatuses')}</option>
          </Select>
        </Field>
      </HStack>
    </SectionCard>
  );
}
