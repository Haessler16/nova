'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import type { Reservation } from '@/lib/types';
import { EMPTY_SEARCH_FILTERS, type SearchFilters, type Tenant } from '../_lib/front-office.types';
import {
  clearSearchQuery,
  hasActiveFilters,
  readInitialSearchFilters,
  readInitialTabIndex,
  syncSearchQuery,
} from '../_lib/search-url';

export interface ReservationSearch {
  inputs: SearchFilters;
  filters: SearchFilters;
  results: Reservation[];
  nextCursor: string | null;
  loading: boolean;
  error: unknown;
  active: boolean;
  updateInput: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  apply: (event?: FormEvent) => void;
  clear: () => void;
  retry: () => void;
  loadMore: () => void;
}

/** Reservation lookup used by the front-office search panel. */
export function useReservationSearch(
  tenant: Tenant,
  onTabIndex: (index: number) => void,
): ReservationSearch {
  const [inputs, setInputs] = useState<SearchFilters>(EMPTY_SEARCH_FILTERS);
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_SEARCH_FILTERS);
  const [results, setResults] = useState<Reservation[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [active, setActive] = useState(false);

  async function performSearch(nextFilters: SearchFilters, cursor?: string): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '25' });
      if (nextFilters.q.trim() !== '') params.set('search', nextFilters.q.trim());
      if (nextFilters.fromDate !== '') params.set('fromDate', nextFilters.fromDate);
      if (nextFilters.toDate !== '') params.set('toDate', nextFilters.toDate);
      if (nextFilters.status !== '') params.set('status', nextFilters.status);
      if (cursor !== undefined) params.set('cursor', cursor);
      const body = await api<{ items: Reservation[]; nextCursor: string | null }>(
        `/api/v1/reservations?${params.toString()}`,
        { tenant },
      );
      setResults((current) => (cursor === undefined ? body.items : [...current, ...body.items]));
      setNextCursor(body.nextCursor);
    } catch (cause) {
      setError(cause);
    } finally {
      setLoading(false);
    }
  }

  function apply(event?: FormEvent): void {
    event?.preventDefault();
    const next = { ...inputs };
    setFilters(next);
    setActive(true);
    setResults([]);
    setNextCursor(null);
    syncSearchQuery(next);
    void performSearch(next);
  }

  function clear(): void {
    setInputs(EMPTY_SEARCH_FILTERS);
    setFilters(EMPTY_SEARCH_FILTERS);
    setActive(false);
    setResults([]);
    setNextCursor(null);
    setError(null);
    clearSearchQuery();
  }

  function updateInput<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]): void {
    setInputs((current) => ({ ...current, [key]: value }));
  }

  const bootstrapped = useRef(false);
  const performSearchRef = useRef(performSearch);
  performSearchRef.current = performSearch;

  useEffect(() => {
    if (bootstrapped.current) {
      return;
    }
    bootstrapped.current = true;
    const tabIndex = readInitialTabIndex();
    if (tabIndex !== null) {
      onTabIndex(tabIndex);
    }
    const initial = readInitialSearchFilters();
    if (hasActiveFilters(initial)) {
      setInputs(initial);
      setFilters(initial);
      setActive(true);
      void performSearchRef.current(initial);
    }
  }, [onTabIndex]);

  return {
    inputs,
    filters,
    results,
    nextCursor,
    loading,
    error,
    active,
    updateInput,
    apply,
    clear,
    retry: () => void performSearch(filters),
    loadMore: () => {
      if (nextCursor !== null) {
        void performSearch(filters, nextCursor);
      }
    },
  };
}
