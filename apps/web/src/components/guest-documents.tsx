'use client';

import {
  Box,
  Button,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Spinner,
  Stack,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { RESERVATION_STATUS_LABELS, formatCalendarDate } from '@/lib/format';
import type { Reservation } from '@/lib/types';
import { ReservationDocuments } from './documents-panel';

interface GuestDocumentsProps {
  guestId: string;
  guestName: string;
}

/**
 * Documents are generated from a reservation snapshot, so a guest action must
 * first choose one of that guest's eligible reservations. Cancelled and no-show
 * reservations are excluded because the backend rejects them.
 */
export function GuestDocuments({ guestId, guestName }: GuestDocumentsProps) {
  const picker = useDisclosure();
  const { organizationId, propertyId } = useSession();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [pending, setPending] = useState<Reservation | null>(null);
  const [chosen, setChosen] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
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
      setReservations(eligible);
      setSelectedId(eligible[0]?.id ?? '');
    } catch (cause) {
      setError(cause);
    } finally {
      setLoading(false);
    }
  }, [guestId, organizationId, propertyId]);

  useEffect(() => {
    if (picker.isOpen) {
      setPending(null);
      setChosen(null);
      void load();
    }
  }, [load, picker.isOpen]);

  const selected = reservations.find((reservation) => reservation.id === selectedId) ?? null;

  function openDocuments(): void {
    if (selected === null) {
      return;
    }
    // Wait for the picker to finish closing before mounting the document modal;
    // two simultaneous Chakra modals can leave the second one in its initial
    // hidden transition state.
    setPending(selected);
    picker.onClose();
  }

  return (
    <>
      <Button size="xs" variant="ghost" onClick={picker.onOpen}>
        Documentos
      </Button>

      <Modal
        isOpen={picker.isOpen}
        onClose={picker.onClose}
        onCloseComplete={() => {
          if (pending !== null) {
            setChosen(pending);
            setPending(null);
          }
        }}
        size="md"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Documentos de {guestName}
            <Text fontSize="sm" fontWeight="normal" color="gray.500">
              Elegí la reserva que querés usar como origen del documento.
            </Text>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {loading ? (
              <HStack justify="center" py={8}>
                <Spinner size="sm" />
                <Text fontSize="sm" color="gray.500">
                  Cargando reservas…
                </Text>
              </HStack>
            ) : error !== null ? (
              <Box borderWidth="1px" borderColor="danger.200" bg="danger.50" p={3} rounded="md">
                <Text fontSize="sm" color="danger.700">
                  {errorMessage(error)}
                </Text>
                <Button size="xs" mt={2} variant="outline" onClick={() => void load()}>
                  Reintentar
                </Button>
              </Box>
            ) : reservations.length === 0 ? (
              <Text fontSize="sm" color="gray.600">
                No hay reservas activas para este huésped. Los documentos necesitan una reserva
                confirmada o en estadía.
              </Text>
            ) : (
              <Stack spacing={3}>
                <Text fontSize="sm" color="gray.600">
                  Sólo se muestran reservas que permiten generar documentos. La fecha del documento
                  se toma de la reserva, no del reloj del navegador.
                </Text>
                <Select
                  aria-label="Reserva para generar documentos"
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  {reservations.map((reservation) => (
                    <option key={reservation.id} value={reservation.id}>
                      {reservation.code} · {formatCalendarDate(reservation.checkInDate)} →{' '}
                      {formatCalendarDate(reservation.checkOutDate)} ·{' '}
                      {RESERVATION_STATUS_LABELS[reservation.status]}
                    </option>
                  ))}
                </Select>
              </Stack>
            )}
          </ModalBody>
          <ModalFooter gap={2}>
            <Button variant="ghost" onClick={picker.onClose}>
              Cerrar
            </Button>
            {reservations.length > 0 && (
              <Button colorScheme="brand" onClick={openDocuments} isDisabled={selected === null}>
                Abrir documentos
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {chosen !== null && (
        <ReservationDocuments
          key={chosen.id}
          reservationId={chosen.id}
          reservationCode={chosen.code}
          hideTrigger
          defaultOpen
          onClose={() => setChosen(null)}
        />
      )}
    </>
  );
}
