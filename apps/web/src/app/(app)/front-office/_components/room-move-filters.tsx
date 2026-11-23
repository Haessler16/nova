'use client';

import { Checkbox, HStack, Input, Select, SimpleGrid, Text } from '@chakra-ui/react';
import { Field } from '@/components/ui';
import { housekeepingLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { HousekeepingState } from '@/lib/types';
import type { MoveFilters } from '../_lib/front-office.types';

const HOUSEKEEPING_STATES: HousekeepingState[] = ['DIRTY', 'CLEANING', 'CLEAN', 'INSPECTED'];

export function MoveFiltersGrid({
  filters,
  options,
  onChange,
}: {
  filters: MoveFilters;
  options: {
    roomTypes: { id: string; name: string; capacityAdults: number; capacityChildren: number }[];
    floors: string[];
    buildings: string[];
  };
  onChange: <K extends keyof MoveFilters>(key: K, value: MoveFilters[K]) => void;
}) {
  const { t, locale } = useI18n();

  return (
    <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
      <Field label={t('frontOffice.move.type')}>
        <Select
          size="sm"
          value={filters.roomTypeId}
          onChange={(event) => onChange('roomTypeId', event.target.value)}
        >
          <option value="">{t('frontOffice.move.all')}</option>
          {options.roomTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name} ({type.capacityAdults}A/{type.capacityChildren}N)
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('frontOffice.move.floorLabel')}>
        <Select
          size="sm"
          value={filters.floor}
          onChange={(event) => onChange('floor', event.target.value)}
        >
          <option value="">{t('frontOffice.move.all')}</option>
          {options.floors.map((floor) => (
            <option key={floor} value={floor}>
              {floor}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('frontOffice.move.building')}>
        <Select
          size="sm"
          value={filters.building}
          onChange={(event) => onChange('building', event.target.value)}
        >
          <option value="">{t('frontOffice.move.allF')}</option>
          {options.buildings.map((building) => (
            <option key={building} value={building}>
              {building}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('frontOffice.move.housekeeping')}>
        <Select
          size="sm"
          value={filters.housekeeping}
          onChange={(event) =>
            onChange('housekeeping', event.target.value as MoveFilters['housekeeping'])
          }
        >
          <option value="">{t('frontOffice.move.all')}</option>
          {HOUSEKEEPING_STATES.map((state) => (
            <option key={state} value={state}>
              {housekeepingLabel(locale, state)}
            </option>
          ))}
        </Select>
      </Field>
    </SimpleGrid>
  );
}

export function MoveSearchRow({
  filters,
  onChange,
  filteredCount,
  totalCount,
}: {
  filters: MoveFilters;
  onChange: <K extends keyof MoveFilters>(key: K, value: MoveFilters[K]) => void;
  filteredCount: number;
  totalCount: number;
}) {
  const { t } = useI18n();
  return (
    <HStack spacing={3} wrap="wrap" align="flex-end" justify="space-between">
      <Field label={t('frontOffice.move.searchRoom')}>
        <Input
          size="sm"
          width="160px"
          value={filters.search}
          onChange={(event) => onChange('search', event.target.value)}
        />
      </Field>
      <Checkbox
        size="sm"
        isChecked={filters.showIneligible}
        onChange={(event) => onChange('showIneligible', event.target.checked)}
      >
        {t('frontOffice.move.showIneligible')}
      </Checkbox>
      <Text fontSize="xs" color="gray.500">
        {t('frontOffice.move.count', { filtered: filteredCount, total: totalCount })}
      </Text>
    </HStack>
  );
}
