'use client';

import { Button, useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import type { Reservation } from '@/lib/types';
import { ReservationDocuments } from './documents-panel';

interface GuestDocumentsProps {
  guestId: string;
  guestName: string;
}

/**
 * Documents are generated from a reservation snapshot, so a guest action must
 * first load that guest's eligible reservations. The selection happens inside
 * the existing document modal to avoid stacking two Chakra modals.
 */
export function GuestDocuments({ guestId, guestName }: GuestDocumentsProps) {
  const toast = useToast();
  const { organizationId, propertyId } = useSession();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(false);

  async function openDocuments(): Promise<void> {
    setLoading(true);
    try {
      const response = await api<{ items: Reservation[] }>(
        `/api/v1/reservations?guestId=${encodeURIComponent(guestId)}&limit=100`,
        { tenant: { organizationId, propertyId } },
      );
      const eligible = response.items
        .filter(
          (reservation) => reservation.status !== 'CANCELLED' && reservation.status !== 'NO_SHOW',
        )
        .sort((left, right) => right.checkInDate.localeCompare(left.checkInDate));

      if (eligible.length === 0) {
        toast({
          title: 'Sin reservas disponibles',
          description:
            'Los documentos necesitan una reserva confirmada o en estadía para este huésped.',
          status: 'warning',
        });
        return;
      }

      setReservations(eligible);
      setSelected(eligible[0] ?? null);
    } catch (cause) {
      toast({
        title: 'No se pudieron cargar las reservas',
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        size="xs"
        variant="ghost"
        aria-label={`Documentos de ${guestName}`}
        isLoading={loading}
        onClick={() => void openDocuments()}
      >
        Documentos
      </Button>

      {selected !== null && (
        <ReservationDocuments
          key={selected.id}
          reservationId={selected.id}
          reservationCode={selected.code}
          reservations={reservations}
          hideTrigger
          defaultOpen
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
