import { RESERVATION_STATUS_COLORS } from '@/lib/format';
import type { ReservationStatus } from '@/lib/types';
import { EMPTY_SEARCH_FILTERS, TAB_INDEX, type SearchFilters } from './front-office.types';

export function readInitialTabIndex(): number | null {
  const tab = new URLSearchParams(window.location.search).get('tab');
  if (tab === null) {
    return null;
  }
  const index = TAB_INDEX[tab];
  return index === undefined ? null : index;
}

export function readInitialSearchFilters(): SearchFilters {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');
  const validStatus =
    status !== null && Object.prototype.hasOwnProperty.call(RESERVATION_STATUS_COLORS, status);
  return {
    q: params.get('q') ?? '',
    fromDate: params.get('fromDate') ?? '',
    toDate: params.get('toDate') ?? '',
    status: validStatus ? (status as ReservationStatus) : '',
  };
}

export function hasActiveFilters(filters: SearchFilters): boolean {
  return Object.values(filters).some((value) => value !== '');
}

export function syncSearchQuery(filters: SearchFilters): void {
  const params = new URLSearchParams(window.location.search);
  const mapping: Array<[keyof SearchFilters, string]> = [
    ['q', 'q'],
    ['fromDate', 'fromDate'],
    ['toDate', 'toDate'],
    ['status', 'status'],
  ];
  for (const [key, param] of mapping) {
    const value = filters[key].trim();
    if (value === '') {
      params.delete(param);
    } else {
      params.set(param, value);
    }
  }
  const query = params.toString();
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${query === '' ? '' : `?${query}`}`,
  );
}

export function clearSearchQuery(): void {
  syncSearchQuery(EMPTY_SEARCH_FILTERS);
}
