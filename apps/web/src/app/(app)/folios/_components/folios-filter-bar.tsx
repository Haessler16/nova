'use client';

import { HStack, Input, Select } from '@chakra-ui/react';
import { Field, SectionCard } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

export interface FoliosFilters {
  status: string;
  search: string;
}

export function FoliosFilterBar({
  filters,
  onChange,
}: {
  filters: FoliosFilters;
  onChange: (updater: (current: FoliosFilters) => FoliosFilters) => void;
}) {
  const { t } = useI18n();

  return (
    <SectionCard mb={5}>
      <HStack spacing={3} wrap="wrap" align="flex-end">
        <Field label={t('folios.filter.search')}>
          <Input
            size="sm"
            placeholder={t('folios.filter.searchPlaceholder')}
            value={filters.search}
            onChange={(event) =>
              onChange((current) => ({ ...current, search: event.target.value }))
            }
          />
        </Field>
        <Field label={t('folios.filter.status')}>
          <Select
            size="sm"
            value={filters.status}
            onChange={(event) =>
              onChange((current) => ({ ...current, status: event.target.value }))
            }
          >
            <option value="">{t('folios.filter.all')}</option>
            <option value="OPEN">{t('folios.filter.open')}</option>
            <option value="SETTLED">{t('folios.filter.settled')}</option>
            <option value="CANCELLED">{t('folios.filter.cancelled')}</option>
          </Select>
        </Field>
      </HStack>
    </SectionCard>
  );
}
