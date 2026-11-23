'use client';

import { useState } from 'react';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import type { RoomListResponse, RoomType } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { EMPTY_FILTERS, type RoomsData, type RoomsFilters } from '../_lib/rooms';
import { useLiveRooms } from './use-live-rooms';

function buildQuery(filters: RoomsFilters): string {
  const params = new URLSearchParams();
  if (filters.search !== '') params.set('search', filters.search);
  if (filters.roomTypeId !== '') params.set('roomTypeId', filters.roomTypeId);
  if (filters.floor !== '') params.set('floor', filters.floor);
  if (filters.building !== '') params.set('building', filters.building);
  if (filters.minCapacity !== '') params.set('minCapacity', filters.minCapacity);
  if (filters.occupancy !== '') params.set('occupancy', filters.occupancy);
  if (filters.operationalState !== '') params.set('operationalState', filters.operationalState);
  if (filters.housekeepingState !== '') params.set('housekeepingState', filters.housekeepingState);
  params.set('limit', '100');
  return params.toString();
}

export function useRoomsList() {
  const { tenant } = useSession();
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<RoomsFilters>(EMPTY_FILTERS);

  const { data, loading, error, reload, reloadSilent } = useAsyncData<RoomsData>(
    async () => {
      const [rooms, roomTypes] = await Promise.all([
        api<RoomListResponse>(`/api/v1/inventory/rooms?${buildQuery(filters)}`, { tenant }),
        api<{ items: RoomType[] }>('/api/v1/inventory/room-types?status=ACTIVE', { tenant }),
      ]);
      return {
        rooms: rooms.items,
        roomTypes: roomTypes.items,
        summary: rooms.summary,
        facets: rooms.facets,
      };
    },
    `${tenant.organizationId}:${tenant.propertyId}:rooms:${JSON.stringify(filters)}`,
  );

  const liveMode = useLiveRooms(tenant.organizationId, tenant.propertyId, reloadSilent);

  function applySearch(): void {
    setFilters((current) => ({ ...current, search: searchInput.trim() }));
  }

  function clearFilters(): void {
    setSearchInput('');
    setFilters(EMPTY_FILTERS);
  }

  return {
    data,
    loading,
    error,
    reload,
    reloadSilent,
    liveMode,
    searchInput,
    setSearchInput,
    filters,
    setFilters,
    applySearch,
    clearFilters,
  };
}

export type RoomsList = ReturnType<typeof useRoomsList>;
