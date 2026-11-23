'use client';

import { Button, HStack, Input, Stack, Text } from '@chakra-ui/react';
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
              placeholder="Número, piso, edificio…"
              value={searchInput}
              onChange={(event) => onSearchInput(event.target.value)}
            />
            <Button size="sm" type="submit" variant="outline">
              Buscar
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
          Limpiar
        </Button>
      </HStack>
      <Text fontSize="xs" color="textSecondary">
        {total} habitaciones cargadas (máximo 100 por consulta).
      </Text>
    </Stack>
  );
}
