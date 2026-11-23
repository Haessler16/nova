'use client';

import { useDisclosure } from '@chakra-ui/react';
import { useReducer, useState } from 'react';
import { api } from '@/lib/api';
import { todayISO } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Availability, Guest, Reservation, ReservationHistoryEntry } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import type { Tenant } from './use-reservation-list';

export function useReservationDetail(tenant: Tenant, propertyTimezone: string | undefined) {
  const { t } = useI18n();
  const drawer = useDisclosure();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailVersion, bumpDetail] = useReducer((value: number) => value + 1, 0);

  const detail = useAsyncData<{
    reservation: Reservation;
    history: ReservationHistoryEntry[];
    guest: Guest;
  }>(
    async () => {
      if (selectedId === null) {
        throw new Error(t('reservations.detail.empty'));
      }
      const reservation = await api<Reservation>(`/api/v1/reservations/${selectedId}`, { tenant });
      const [history, guest] = await Promise.all([
        api<{ items: ReservationHistoryEntry[] }>(
          `/api/v1/reservations/${selectedId}/history?limit=100`,
          { tenant },
        ),
        api<Guest>(`/api/v1/guests/${reservation.guest.id}`, { tenant }),
      ]);
      return { reservation, history: history.items, guest };
    },
    `${selectedId ?? 'none'}:${detailVersion}`,
  );

  const selectedReservation = detail.data?.reservation ?? null;
  const detailGuest = detail.data?.guest ?? null;
  const today = todayISO(0, propertyTimezone);
  const checkInEligible =
    selectedReservation !== null &&
    selectedReservation.checkInDate <= today &&
    selectedReservation.checkOutDate > today;

  const detailAvailability = useAsyncData<Availability>(
    async () => {
      if (selectedReservation === null) {
        return { checkInDate: '', checkOutDate: '', nights: 0, items: [] };
      }
      const params = new URLSearchParams({
        checkInDate: selectedReservation.checkInDate,
        checkOutDate: selectedReservation.checkOutDate,
        roomTypeId: selectedReservation.roomTypeId,
      });
      return api<Availability>(`/api/v1/reservations/availability?${params.toString()}`, {
        tenant,
      });
    },
    `${selectedReservation?.id ?? 'none'}:${selectedReservation?.roomTypeId ?? ''}:${detailVersion}`,
  );

  function openDetail(reservation: Reservation): void {
    setSelectedId(reservation.id);
    drawer.onOpen();
    bumpDetail();
  }

  return {
    drawer,
    selectedId,
    setSelectedId,
    detail,
    bumpDetail,
    selectedReservation,
    detailGuest,
    today,
    checkInEligible,
    detailAvailability,
    openDetail,
  };
}

export type ReservationDetailController = ReturnType<typeof useReservationDetail>;
