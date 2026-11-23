'use client';

import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import type { Reservation } from '@/lib/types';
import type { ReservationListController, Tenant } from './use-reservation-list';

/**
 * Supports the links the app shares: `?new=1` opens the create modal,
 * `?search=` presets the list filter and `?reservation=` opens the drawer.
 * Runs once per tenant; a stale deep link leaves the list usable.
 */
export function useReservationDeepLink({
  tenant,
  list,
  openCreate,
  openDetail,
}: {
  tenant: Tenant;
  list: ReservationListController;
  openCreate: () => void;
  openDetail: (reservation: Reservation) => void;
}) {
  const opened = useRef(false);
  const listRef = useRef(list);
  listRef.current = list;
  const createRef = useRef(openCreate);
  createRef.current = openCreate;
  const detailRef = useRef(openDetail);
  detailRef.current = openDetail;

  useEffect(() => {
    if (opened.current) {
      return;
    }
    opened.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') {
      createRef.current();
    }
    const search = params.get('search');
    if (search !== null && search.trim() !== '') {
      listRef.current.setSearchInput(search.trim());
      listRef.current.setFilters((current) => ({ ...current, search: search.trim() }));
    }
    const reservationParam = params.get('reservation');
    if (reservationParam !== null) {
      void api<Reservation>(`/api/v1/reservations/${reservationParam}`, { tenant })
        .then((reservation) => detailRef.current(reservation))
        .catch(() => {
          // The list stays usable if the deep link is stale or unauthorized.
        });
    }
  }, [tenant]);
}
