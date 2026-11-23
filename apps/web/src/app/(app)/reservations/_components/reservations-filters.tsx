'use client';

import { Button, HStack, Input, Select, Stack, Text } from '@chakra-ui/react';
import { DateField } from '@/components/date-field';
import { RESERVATION_STATUS_COLORS, reservationStatusLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { ReservationStatus } from '@/lib/types';
import type { ReservationListController } from '../_hooks/use-reservation-list';

function DateRangeFilter({ list }: { list: ReservationListController }) {
  const { t } = useI18n();
  return (
    <HStack spacing={1}>
      <Text fontSize="xs" color="textSecondary">
        {t('reservations.filter.from')}
      </Text>
      <DateField
        size="sm"
        width="150px"
        value={list.filters.fromDate}
        placeholder="dd/mm/aaaa"
        ariaLabel={t('reservations.filter.fromAria')}
        isClearable
        onChange={(fromDate) =>
          list.setFilters({
            ...list.filters,
            fromDate,
            ...(list.filters.toDate !== '' && list.filters.toDate <= fromDate
              ? { toDate: '' }
              : {}),
          })
        }
      />
      <Text fontSize="xs" color="textSecondary">
        {t('reservations.filter.to')}
      </Text>
      <DateField
        size="sm"
        width="150px"
        value={list.filters.toDate}
        min={list.filters.fromDate !== '' ? list.filters.fromDate : undefined}
        placeholder="dd/mm/aaaa"
        ariaLabel={t('reservations.filter.toAria')}
        isClearable
        onChange={(toDate) => list.setFilters({ ...list.filters, toDate })}
      />
    </HStack>
  );
}

export function ReservationsFilters({ list }: { list: ReservationListController }) {
  const { t, locale } = useI18n();
  const count = list.data?.items.length ?? 0;

  return (
    <Stack spacing={3} mb={4}>
      <HStack wrap="wrap" spacing={2}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            list.submitSearch();
          }}
        >
          <HStack>
            <Input
              size="sm"
              width="240px"
              placeholder={t('reservations.searchPlaceholder')}
              value={list.searchInput}
              onChange={(event) => list.setSearchInput(event.target.value)}
            />
            <Button size="sm" type="submit" variant="outline">
              {t('reservations.search')}
            </Button>
          </HStack>
        </form>
        <Select
          size="sm"
          width="170px"
          aria-label={t('reservations.filter.status')}
          value={list.filters.status}
          onChange={(event) =>
            list.setFilters({ ...list.filters, status: event.target.value })
          }
        >
          <option value="">{t('reservations.filter.allStatuses')}</option>
          {(Object.keys(RESERVATION_STATUS_COLORS) as ReservationStatus[]).map((value) => (
            <option key={value} value={value}>
              {reservationStatusLabel(locale, value)}
            </option>
          ))}
        </Select>
        <DateRangeFilter list={list} />
        <Button size="sm" variant="ghost" onClick={list.clearFilters}>
          {t('reservations.filter.clear')}
        </Button>
      </HStack>
      <Text fontSize="xs" color="textSecondary">
        {count === 1
          ? t('reservations.countOne', { count })
          : t('reservations.countOther', { count })}
        {list.data?.nextCursor != null ? ` ${t('reservations.moreResults')}` : ''}
      </Text>
    </Stack>
  );
}
