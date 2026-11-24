'use client';

import { Button, HStack, Input, Stack, Text } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { RoomListFacets, RoomType } from '@/lib/types';
import type { RoomsFilters } from '../_lib/rooms';
import { RoomsFilterSelects } from './rooms-filter-selects';

export function RoomsFilterBar({
  searchInput,
  onSearchInput,
  onSearch,
  filters,
  onChange,
  onClear,
  roomTypes,
  facets,
  total,
}: {
  searchInput: string;
  onSearchInput: (value: string) => void;
  onSearch: () => void;
  filters: RoomsFilters;
  onChange: (filters: RoomsFilters) => void;
  onClear: () => void;
  roomTypes: RoomType[] | undefined;
  facets: RoomListFacets | undefined;
  total: number;
}) {
  const { t } = useI18n();

  return (
    <Stack spacing={3} mb={4}>
      <HStack wrap="wrap" spacing={2}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSearch();
          }}
        >
          <HStack>
            <Input
              size="sm"
              width="220px"
              placeholder={t('rooms.filters.searchPlaceholder')}
              value={searchInput}
              onChange={(event) => onSearchInput(event.target.value)}
            />
            <Button size="sm" type="submit" variant="outline">
              {t('rooms.filters.search')}
            </Button>
          </HStack>
        </form>
        <RoomsFilterSelects
          filters={filters}
          onChange={onChange}
          roomTypes={roomTypes}
          facets={facets}
        />
        <Button size="sm" variant="ghost" onClick={onClear}>
          {t('rooms.filters.clear')}
        </Button>
      </HStack>
      <Text fontSize="xs" color="textSecondary">
        {t('rooms.filters.loaded', { count: total })}
      </Text>
    </Stack>
  );
}
