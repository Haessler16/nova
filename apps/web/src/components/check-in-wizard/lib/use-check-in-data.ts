'use client';

import { useEffect, useReducer } from 'react';
import { api, type TenantSelection } from '@/lib/api';
import type {
  CheckInReadiness,
  Reservation,
  ReservationInstruction,
  ReservationParty,
} from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { isCheckInRelevant } from './check-in-labels';

export function useCheckInData({
  isOpen,
  reservation,
  tenant,
}: {
  isOpen: boolean;
  reservation: Reservation | null;
  tenant: TenantSelection;
}) {
  const [version, bumpVersion] = useReducer((value: number) => value + 1, 0);
  const reservationId = reservation?.id ?? null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    bumpVersion();
  }, [isOpen, reservation?.id, reservation?.roomId]);

  const readiness = useAsyncData<CheckInReadiness | null>(
    () =>
      reservationId === null
        ? Promise.resolve(null)
        : api<CheckInReadiness>(
            `/api/v1/front-office/reservations/${reservationId}/check-in-readiness`,
            { tenant },
          ),
    `${tenant.organizationId}:${tenant.propertyId}:check-in-readiness:${reservationId ?? 'none'}:${version}`,
  );

  const party = useAsyncData<ReservationParty | null>(
    () =>
      reservationId === null
        ? Promise.resolve(null)
        : api<ReservationParty>(`/api/v1/reservations/${reservationId}/party`, { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:check-in-party:${reservationId ?? 'none'}:${version}`,
  );

  const instructions = useAsyncData<{ items: ReservationInstruction[] }>(
    () =>
      reservationId === null
        ? Promise.resolve({ items: [] })
        : api<{ items: ReservationInstruction[] }>(
            `/api/v1/reservations/${reservationId}/instructions?limit=100`,
            { tenant },
          ),
    `${tenant.organizationId}:${tenant.propertyId}:check-in-instructions:${reservationId ?? 'none'}`,
  );

  const relevantInstructions = (instructions.data?.items ?? []).filter(isCheckInRelevant);

  return { readiness, party, instructions, relevantInstructions, bumpVersion };
}
