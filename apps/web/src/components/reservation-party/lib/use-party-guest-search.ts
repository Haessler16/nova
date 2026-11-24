'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import type { Guest } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

export function usePartyGuestSearch(kind: 'adult' | 'minor', editing: boolean) {
  const { tenant } = useSession();
  const [guestSearch, setGuestSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(guestSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [guestSearch]);

  const guests = useAsyncData<{ items: Guest[] }>(async () => {
    if (kind !== 'adult' || editing) return { items: [] };
    const params = new URLSearchParams({ status: 'ACTIVE', limit: '6' });
    if (debouncedSearch !== '') params.set('search', debouncedSearch);
    return api<{ items: Guest[] }>(`/api/v1/guests?${params.toString()}`, { tenant });
  }, `${tenant.organizationId}:${tenant.propertyId}:party-guest-search:${debouncedSearch}:${editing}:${kind}`);

  return { guestSearch, setGuestSearch, guests };
}
