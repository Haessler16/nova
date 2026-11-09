'use client';

import { create } from 'zustand';
import { api, type TenantSelection } from '@/lib/api';
import type { AuditEvent } from '@/lib/types';

export interface AuditFilters {
  action: string;
  entityType: string;
  actorUserId: string;
  fromDate: string;
  toDate: string;
}

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  action: '',
  entityType: '',
  actorUserId: '',
  fromDate: '',
  toDate: '',
};

interface AuditPageData {
  items: AuditEvent[];
  nextCursor: string | null;
}

interface LoadAuditInput {
  tenantKey: string;
  tenant: TenantSelection;
  filters: AuditFilters;
}

interface AuditFeedState {
  tenantKey: string | null;
  filters: AuditFilters;
  items: AuditEvent[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: unknown;
  moreError: unknown;
  requestId: number;
  load: (input: LoadAuditInput) => Promise<void>;
  loadMore: (tenant: TenantSelection) => Promise<void>;
  setFilters: (filters: AuditFilters) => void;
  reset: () => void;
}

function buildParams(filters: AuditFilters): URLSearchParams {
  const params = new URLSearchParams({ limit: '50' });
  if (filters.action.trim() !== '') {
    params.set('action', filters.action.trim().toUpperCase());
  }
  if (filters.entityType.trim() !== '') {
    params.set('entityType', filters.entityType.trim());
  }
  if (filters.actorUserId.trim() !== '') {
    params.set('actorUserId', filters.actorUserId.trim());
  }
  if (filters.fromDate !== '') {
    params.set('fromDate', filters.fromDate);
  }
  if (filters.toDate !== '') {
    params.set('toDate', filters.toDate);
  }
  return params;
}

/**
 * Client-only audit feed state. It deliberately does not store the tenant
 * object or any authorization decision: the caller passes the validated
 * selection and the backend remains the authority.
 *
 * `tenantKey` scopes cached items to one property. Switching property reloads
 * and replaces the feed instead of mixing rows across tenants.
 */
export const useAuditFeedStore = create<AuditFeedState>((set, get) => ({
  tenantKey: null,
  filters: EMPTY_AUDIT_FILTERS,
  items: [],
  nextCursor: null,
  loading: false,
  loadingMore: false,
  error: null,
  moreError: null,
  requestId: 0,

  load: async ({ tenantKey, tenant, filters }) => {
    const requestId = get().requestId + 1;
    set({
      requestId,
      tenantKey,
      filters,
      items: [],
      nextCursor: null,
      loading: true,
      loadingMore: false,
      error: null,
      moreError: null,
    });

    try {
      const data = await api<AuditPageData>(
        `/api/v1/audit-events?${buildParams(filters).toString()}`,
        { tenant },
      );
      if (get().requestId !== requestId) {
        return;
      }
      set({ items: data.items, nextCursor: data.nextCursor, loading: false });
    } catch (error) {
      if (get().requestId !== requestId) {
        return;
      }
      set({ error, loading: false });
    }
  },

  loadMore: async (tenant) => {
    const { nextCursor, filters, requestId, loadingMore } = get();
    if (nextCursor === null || loadingMore) {
      return;
    }

    set({ loadingMore: true, moreError: null });
    try {
      const params = buildParams(filters);
      params.set('cursor', nextCursor);
      const data = await api<AuditPageData>(`/api/v1/audit-events?${params.toString()}`, {
        tenant,
      });
      if (get().requestId !== requestId) {
        return;
      }
      set((state) => ({
        items: [...state.items, ...data.items],
        nextCursor: data.nextCursor,
        loadingMore: false,
      }));
    } catch (error) {
      if (get().requestId !== requestId) {
        return;
      }
      set({ moreError: error, loadingMore: false });
    }
  },

  setFilters: (filters) => set({ filters }),

  reset: () =>
    set((state) => ({
      tenantKey: null,
      filters: { ...EMPTY_AUDIT_FILTERS },
      items: [],
      nextCursor: null,
      loading: false,
      loadingMore: false,
      error: null,
      moreError: null,
      requestId: state.requestId + 1,
    })),
}));
