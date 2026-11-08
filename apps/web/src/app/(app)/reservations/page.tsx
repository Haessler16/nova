'use client';

import {
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { useReducer, useState, type FormEvent } from 'react';
import { PropertyGate } from '@/components/app-shell';
import {
  Field,
  KeyValue,
  PageHeader,
  QueryFeedback,
  SectionCard,
  StatusBadge,
} from '@/components/ui';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import {
  RESERVATION_STATUS_COLORS,
  RESERVATION_STATUS_LABELS,
  formatCalendarDate,
  formatDateTime,
  nightsBetween,
  todayISO,
} from '@/lib/format';
import type {
  Availability,
  Guest,
  Reservation,
  ReservationHistoryEntry,
  RoomType,
} from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

interface ListData {
  items: Reservation[];
  nextCursor: string | null;
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const ACTION_LABELS: Record<string, string> = {
  'reservation.created': 'Reserva creada',
  'reservation.updated': 'Reserva actualizada',
  'reservation.room_assigned': 'Habitación asignada',
  'reservation.room_reassigned': 'Habitación reasignada',
  'reservation.room_unassigned': 'Habitación liberada',
  'reservation.cancelled': 'Reserva cancelada',
  'reservation.status_changed': 'Estado modificado',
};

function ReservationsContent() {
  const { tenant } = useSession();
  const toast = useToast();

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    fromDate: '',
    toDate: '',
  });

  const { data, loading, error, reload } = useAsyncData<ListData>(
    () => {
      const params = new URLSearchParams({ limit: '100' });
      if (filters.search !== '') params.set('search', filters.search);
      if (filters.status !== '') params.set('status', filters.status);
      if (filters.fromDate !== '') params.set('fromDate', filters.fromDate);
      if (filters.toDate !== '') params.set('toDate', filters.toDate);
      return api<ListData>(`/api/v1/reservations?${params.toString()}`, { tenant });
    },
    `${tenant.organizationId}:${tenant.propertyId}:reservations:${JSON.stringify(filters)}`,
  );

  const createModal = useDisclosure();
  const editModal = useDisclosure();
  const cancelModal = useDisclosure();
  const drawer = useDisclosure();
  const [detailVersion, bumpDetail] = useReducer((value: number) => value + 1, 0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [createForm, setCreateForm] = useState({
    checkInDate: todayISO(),
    checkOutDate: todayISO(1),
    adults: '2',
    children: '0',
    guestId: '',
    roomTypeId: '',
    roomId: '',
    code: '',
    source: '',
    notes: '',
    idempotencyKey: newIdempotencyKey(),
  });
  const [guestFilter, setGuestFilter] = useState('');

  const [editForm, setEditForm] = useState({
    checkInDate: '',
    checkOutDate: '',
    adults: '1',
    children: '0',
    notes: '',
  });
  const [cancelReason, setCancelReason] = useState('');
  const [assignRoomId, setAssignRoomId] = useState('');

  const lookup = useAsyncData<{ guests: Guest[]; roomTypes: RoomType[] }>(
    async () => {
      if (!createModal.isOpen && !editModal.isOpen) {
        return { guests: [], roomTypes: [] };
      }
      const [guests, roomTypes] = await Promise.all([
        api<{ items: Guest[] }>('/api/v1/guests?status=ACTIVE&limit=100', { tenant }),
        api<{ items: RoomType[] }>('/api/v1/inventory/room-types?status=ACTIVE', { tenant }),
      ]);
      return { guests: guests.items, roomTypes: roomTypes.items };
    },
    `${tenant.organizationId}:${tenant.propertyId}:lookups:${String(createModal.isOpen)}:${String(editModal.isOpen)}`,
  );

  const createNights = nightsBetween(createForm.checkInDate, createForm.checkOutDate);
  const createDatesValid =
    createForm.checkInDate !== '' &&
    createForm.checkOutDate !== '' &&
    /^\d{4}-\d{2}-\d{2}$/.test(createForm.checkInDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(createForm.checkOutDate) &&
    createNights >= 1 &&
    createNights <= 366;

  const availability = useAsyncData<Availability>(
    async () => {
      if (!createModal.isOpen || !createDatesValid) {
        return { checkInDate: '', checkOutDate: '', nights: 0, items: [] };
      }
      const params = new URLSearchParams({
        checkInDate: createForm.checkInDate,
        checkOutDate: createForm.checkOutDate,
      });
      if (createForm.roomTypeId !== '') params.set('roomTypeId', createForm.roomTypeId);
      return api<Availability>(`/api/v1/reservations/availability?${params.toString()}`, {
        tenant,
      });
    },
    `${String(createModal.isOpen)}:${createForm.checkInDate}:${createForm.checkOutDate}:${createForm.roomTypeId}`,
  );

  const detail = useAsyncData<{ reservation: Reservation; history: ReservationHistoryEntry[] }>(
    async () => {
      if (selectedId === null) {
        throw new Error('Sin reserva seleccionada');
      }
      const [reservation, history] = await Promise.all([
        api<Reservation>(`/api/v1/reservations/${selectedId}`, { tenant }),
        api<{ items: ReservationHistoryEntry[] }>(
          `/api/v1/reservations/${selectedId}/history?limit=100`,
          { tenant },
        ),
      ]);
      return { reservation, history: history.items };
    },
    `${selectedId ?? 'none'}:${detailVersion}`,
  );

  const selectedReservation = detail.data?.reservation ?? null;

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

  function openCreate(): void {
    setCreateForm({
      checkInDate: todayISO(),
      checkOutDate: todayISO(1),
      adults: '2',
      children: '0',
      guestId: '',
      roomTypeId: '',
      roomId: '',
      code: '',
      source: '',
      notes: '',
      idempotencyKey: newIdempotencyKey(),
    });
    setGuestFilter('');
    createModal.onOpen();
  }

  function openDetail(reservation: Reservation): void {
    setSelectedId(reservation.id);
    setAssignRoomId('');
    drawer.onOpen();
    bumpDetail();
  }

  function openEdit(reservation: Reservation): void {
    setSelectedId(reservation.id);
    setEditForm({
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
      adults: String(reservation.adults),
      children: String(reservation.children),
      notes: reservation.notes ?? '',
    });
    editModal.onOpen();
  }

  async function handleCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (createForm.guestId === '' || createForm.roomTypeId === '') {
      toast({ title: 'Elegí huésped y tipo de habitación', status: 'warning' });
      return;
    }
    if (!createDatesValid) {
      toast({ title: 'La estadía debe tener entre 1 y 366 noches', status: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await api<Reservation>('/api/v1/reservations', {
        method: 'POST',
        tenant,
        body: {
          checkInDate: createForm.checkInDate,
          checkOutDate: createForm.checkOutDate,
          adults: Number(createForm.adults),
          children: Number(createForm.children),
          guestId: createForm.guestId,
          roomTypeId: createForm.roomTypeId,
          ...(createForm.roomId !== '' ? { roomId: createForm.roomId } : {}),
          ...(createForm.code.trim() !== '' ? { code: createForm.code.trim().toUpperCase() } : {}),
          ...(createForm.source.trim() !== '' ? { source: createForm.source.trim() } : {}),
          ...(createForm.notes.trim() !== '' ? { notes: createForm.notes.trim() } : {}),
          idempotencyKey: createForm.idempotencyKey,
        },
      });
      toast({ title: 'Reserva creada', status: 'success' });
      createModal.onClose();
      reload();
    } catch (cause) {
      toast({
        title: 'No se pudo crear la reserva',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (selectedId === null) {
      return;
    }
    setSaving(true);
    try {
      await api<Reservation>(`/api/v1/reservations/${selectedId}`, {
        method: 'PATCH',
        tenant,
        body: {
          checkInDate: editForm.checkInDate,
          checkOutDate: editForm.checkOutDate,
          adults: Number(editForm.adults),
          children: Number(editForm.children),
          notes: editForm.notes.trim(),
        },
      });
      toast({ title: 'Reserva actualizada', status: 'success' });
      editModal.onClose();
      reload();
      bumpDetail();
    } catch (cause) {
      toast({
        title: 'No se pudo actualizar',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign(): Promise<void> {
    if (selectedId === null || assignRoomId === '') {
      return;
    }
    setSaving(true);
    try {
      await api<Reservation>(`/api/v1/reservations/${selectedId}/room-assignment`, {
        method: 'POST',
        tenant,
        body: { roomId: assignRoomId },
      });
      toast({ title: 'Habitación asignada', status: 'success' });
      setAssignRoomId('');
      reload();
      bumpDetail();
    } catch (cause) {
      toast({
        title: 'No se pudo asignar la habitación',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (selectedId === null) {
      return;
    }
    setSaving(true);
    try {
      await api<Reservation>(`/api/v1/reservations/${selectedId}/cancel`, {
        method: 'POST',
        tenant,
        body: cancelReason.trim() === '' ? {} : { reason: cancelReason.trim() },
      });
      toast({ title: 'Reserva cancelada', status: 'success' });
      cancelModal.onClose();
      setCancelReason('');
      reload();
      bumpDetail();
    } catch (cause) {
      toast({
        title: 'No se pudo cancelar',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  const filteredGuests =
    lookup.data?.guests.filter((guest) => {
      const term = guestFilter.trim().toLowerCase();
      if (term === '') return true;
      return (
        guest.fullName.toLowerCase().includes(term) ||
        (guest.email ?? '').toLowerCase().includes(term) ||
        (guest.phone ?? '').toLowerCase().includes(term)
      );
    }) ?? [];

  return (
    <>
      <PageHeader
        title="Reservas"
        description="Estadías por fecha calendario con estancia [check-in, check-out) y una habitación por reserva. Los solapamientos los impide PostgreSQL."
        actions={
          <Button colorScheme="purple" size="sm" onClick={openCreate}>
            Nueva reserva
          </Button>
        }
      />

      <SectionCard>
        <Stack spacing={3} mb={4}>
          <HStack wrap="wrap" spacing={2}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setFilters((current) => ({ ...current, search: searchInput.trim() }));
              }}
            >
              <HStack>
                <Input
                  size="sm"
                  width="240px"
                  placeholder="Código, huésped, habitación…"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
                <Button size="sm" type="submit" variant="outline">
                  Buscar
                </Button>
              </HStack>
            </form>
            <Select
              size="sm"
              width="170px"
              aria-label="Estado"
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            >
              <option value="">Todos los estados</option>
              <option value="CONFIRMED">Confirmadas</option>
              <option value="CANCELLED">Canceladas</option>
            </Select>
            <HStack spacing={1}>
              <Text fontSize="xs" color="gray.500">
                Desde
              </Text>
              <Input
                size="sm"
                type="date"
                width="150px"
                value={filters.fromDate}
                onChange={(event) => setFilters({ ...filters, fromDate: event.target.value })}
              />
              <Text fontSize="xs" color="gray.500">
                Hasta
              </Text>
              <Input
                size="sm"
                type="date"
                width="150px"
                value={filters.toDate}
                onChange={(event) => setFilters({ ...filters, toDate: event.target.value })}
              />
            </HStack>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearchInput('');
                setFilters({ search: '', status: '', fromDate: '', toDate: '' });
              }}
            >
              Limpiar
            </Button>
          </HStack>
          <Text fontSize="xs" color="gray.500">
            {data?.items.length ?? 0} reservas cargadas
            {data?.nextCursor != null ? ' · hay más resultados: refiná los filtros' : ''}
          </Text>
        </Stack>

        <QueryFeedback
          loading={loading}
          error={error}
          onRetry={reload}
          isEmpty={(data?.items.length ?? 0) === 0}
          emptyText="No hay reservas para los filtros seleccionados."
        >
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Código</Th>
                  <Th>Huésped</Th>
                  <Th>Estadía</Th>
                  <Th>Tipo / habitación</Th>
                  <Th>Estado</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {data?.items.map((reservation) => (
                  <Tr key={reservation.id}>
                    <Td>
                      <Text as="code" fontSize="xs" fontWeight="semibold">
                        {reservation.code}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {reservation.source ?? 'directa'}
                      </Text>
                    </Td>
                    <Td>
                      <Text fontWeight="medium">{reservation.guest.fullName}</Text>
                      <Text fontSize="xs" color="gray.500">
                        {reservation.guest.email ?? reservation.guest.phone ?? 'sin contacto'}
                      </Text>
                    </Td>
                    <Td>
                      <Text fontSize="sm">
                        {formatCalendarDate(reservation.checkInDate)} →{' '}
                        {formatCalendarDate(reservation.checkOutDate)}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {reservation.nights} {reservation.nights === 1 ? 'noche' : 'noches'} ·{' '}
                        {reservation.adults} adultos
                        {reservation.children > 0 ? ` · ${reservation.children} menores` : ''}
                      </Text>
                    </Td>
                    <Td>
                      <Text fontSize="sm">{reservation.roomType.name}</Text>
                      <Text fontSize="xs" color="gray.500">
                        {reservation.room !== null
                          ? `Hab. ${reservation.room.number}`
                          : 'Sin asignar'}
                      </Text>
                    </Td>
                    <Td>
                      <StatusBadge
                        color={RESERVATION_STATUS_COLORS[reservation.status]}
                        label={RESERVATION_STATUS_LABELS[reservation.status]}
                      />
                    </Td>
                    <Td>
                      <HStack spacing={1} justify="flex-end">
                        <Button size="xs" variant="ghost" onClick={() => openDetail(reservation)}>
                          Detalle
                        </Button>
                        {reservation.status === 'CONFIRMED' && (
                          <>
                            <Button size="xs" variant="ghost" onClick={() => openEdit(reservation)}>
                              Editar
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              colorScheme="red"
                              onClick={() => {
                                setSelectedId(reservation.id);
                                setCancelReason('');
                                cancelModal.onOpen();
                              }}
                            >
                              Cancelar
                            </Button>
                          </>
                        )}
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </QueryFeedback>
      </SectionCard>

      {/* Create */}
      <Modal isOpen={createModal.isOpen} onClose={createModal.onClose} size="2xl">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleCreate(event)}>
          <ModalHeader>Nueva reserva</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <Field label="Check-in" isRequired>
                  <Input
                    type="date"
                    value={createForm.checkInDate}
                    min={todayISO()}
                    onChange={(event) =>
                      setCreateForm({ ...createForm, checkInDate: event.target.value, roomId: '' })
                    }
                    required
                  />
                </Field>
                <Field label="Check-out" isRequired helper="La noche de check-out no se ocupa.">
                  <Input
                    type="date"
                    value={createForm.checkOutDate}
                    min={createForm.checkInDate}
                    onChange={(event) =>
                      setCreateForm({ ...createForm, checkOutDate: event.target.value, roomId: '' })
                    }
                    required
                  />
                </Field>
              </SimpleGrid>
              <Text fontSize="sm" color={createDatesValid ? 'gray.600' : 'red.500'}>
                {createDatesValid
                  ? `${createNights} ${createNights === 1 ? 'noche' : 'noches'}`
                  : 'La estadía debe tener entre 1 y 366 noches.'}
              </Text>

              <Field label="Buscar huésped">
                <Input
                  size="sm"
                  placeholder="Filtrar huéspedes activos por nombre o contacto"
                  value={guestFilter}
                  onChange={(event) => setGuestFilter(event.target.value)}
                />
              </Field>
              <Field label="Huésped" isRequired helper="Solo huéspedes activos de esta propiedad.">
                <Select
                  value={createForm.guestId}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, guestId: event.target.value })
                  }
                  required
                >
                  <option value="">Seleccionar…</option>
                  {filteredGuests.map((guest) => (
                    <option key={guest.id} value={guest.id}>
                      {guest.fullName}
                      {guest.email !== null ? ` · ${guest.email}` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              {lookup.data !== null && filteredGuests.length === 0 && (
                <Text fontSize="xs" color="orange.600">
                  No hay huéspedes activos que coincidan. Creá uno desde Huéspedes.
                </Text>
              )}

              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                <Field label="Tipo de habitación" isRequired>
                  <Select
                    value={createForm.roomTypeId}
                    onChange={(event) =>
                      setCreateForm({ ...createForm, roomTypeId: event.target.value, roomId: '' })
                    }
                    required
                  >
                    <option value="">Seleccionar…</option>
                    {lookup.data?.roomTypes.map((roomType) => (
                      <option key={roomType.id} value={roomType.id}>
                        {roomType.name} · cap. {roomType.capacityAdults}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Adultos" isRequired>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={createForm.adults}
                    onChange={(event) =>
                      setCreateForm({ ...createForm, adults: event.target.value })
                    }
                    required
                  />
                </Field>
                <Field label="Menores">
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={createForm.children}
                    onChange={(event) =>
                      setCreateForm({ ...createForm, children: event.target.value })
                    }
                  />
                </Field>
              </SimpleGrid>

              {createForm.roomTypeId !== '' && createDatesValid && (
                <Box borderWidth="1px" borderRadius="md" p={3}>
                  <Text fontSize="sm" fontWeight="medium" mb={1}>
                    Disponibilidad
                  </Text>
                  {availability.loading ? (
                    <Text fontSize="xs" color="gray.500">
                      Consultando…
                    </Text>
                  ) : availability.error !== null ? (
                    <Text fontSize="xs" color="red.500">
                      {errorMessage(availability.error)}
                    </Text>
                  ) : (availability.data?.items.length ?? 0) === 0 ? (
                    <Text fontSize="xs" color="orange.600">
                      No hay habitaciones libres de este tipo para el rango elegido.
                    </Text>
                  ) : (
                    <Select
                      size="sm"
                      placeholder="Asignar habitación ahora (opcional)"
                      value={createForm.roomId}
                      onChange={(event) =>
                        setCreateForm({ ...createForm, roomId: event.target.value })
                      }
                    >
                      {availability.data?.items.map((item) => (
                        <option key={item.roomId} value={item.roomId}>
                          Hab. {item.number} · {item.roomType.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Box>
              )}

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <Field label="Código" helper="Opcional: 4–32 mayúsculas, números o guiones.">
                  <Input
                    value={createForm.code}
                    onChange={(event) => setCreateForm({ ...createForm, code: event.target.value })}
                  />
                </Field>
                <Field label="Origen">
                  <Input
                    value={createForm.source}
                    placeholder="mostrador, web, teléfono…"
                    onChange={(event) =>
                      setCreateForm({ ...createForm, source: event.target.value })
                    }
                  />
                </Field>
              </SimpleGrid>
              <Field label="Notas">
                <Textarea
                  rows={2}
                  value={createForm.notes}
                  onChange={(event) => setCreateForm({ ...createForm, notes: event.target.value })}
                />
              </Field>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={createModal.onClose}>
              Cancelar
            </Button>
            <Button type="submit" colorScheme="purple" isLoading={saving}>
              Crear reserva
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit */}
      <Modal isOpen={editModal.isOpen} onClose={editModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleEdit(event)}>
          <ModalHeader>Editar reserva</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <SimpleGrid columns={2} spacing={4}>
                <Field label="Check-in" isRequired>
                  <Input
                    type="date"
                    value={editForm.checkInDate}
                    onChange={(event) =>
                      setEditForm({ ...editForm, checkInDate: event.target.value })
                    }
                    required
                  />
                </Field>
                <Field label="Check-out" isRequired>
                  <Input
                    type="date"
                    value={editForm.checkOutDate}
                    onChange={(event) =>
                      setEditForm({ ...editForm, checkOutDate: event.target.value })
                    }
                    required
                  />
                </Field>
              </SimpleGrid>
              <SimpleGrid columns={2} spacing={4}>
                <Field label="Adultos" isRequired>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={editForm.adults}
                    onChange={(event) => setEditForm({ ...editForm, adults: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Menores">
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={editForm.children}
                    onChange={(event) => setEditForm({ ...editForm, children: event.target.value })}
                  />
                </Field>
              </SimpleGrid>
              <Field label="Notas">
                <Textarea
                  rows={3}
                  value={editForm.notes}
                  onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })}
                />
              </Field>
              <Text fontSize="xs" color="gray.500">
                Cambiar fechas o tipo puede requerir reasignar habitación si la actual deja de ser
                válida.
              </Text>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={editModal.onClose}>
              Cancelar
            </Button>
            <Button type="submit" colorScheme="purple" isLoading={saving}>
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Cancel */}
      <Modal isOpen={cancelModal.isOpen} onClose={cancelModal.onClose} size="md">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleCancel(event)}>
          <ModalHeader>Cancelar reserva</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Text fontSize="sm">
                La reserva queda cancelada y la habitación se libera. La operación es auditable y no
                se elimina el registro.
              </Text>
              <Field label="Motivo" helper="3–500 caracteres, opcional.">
                <Textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                />
              </Field>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={cancelModal.onClose}>
              Volver
            </Button>
            <Button type="submit" colorScheme="red" isLoading={saving}>
              Confirmar cancelación
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Detail */}
      <Drawer isOpen={drawer.isOpen} placement="right" onClose={drawer.onClose} size="lg">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>
            Reserva {selectedReservation?.code ?? ''}
            {selectedReservation !== null && (
              <Text fontSize="sm" fontWeight="normal" color="gray.500">
                {selectedReservation.guest.fullName}
              </Text>
            )}
          </DrawerHeader>
          <DrawerBody pb={10}>
            <QueryFeedback
              loading={detail.loading}
              error={detail.error}
              onRetry={detail.reload}
              isEmpty={selectedReservation === null}
              emptyText="Seleccioná una reserva."
            >
              {selectedReservation !== null && (
                <Stack spacing={5}>
                  <HStack>
                    <StatusBadge
                      color={RESERVATION_STATUS_COLORS[selectedReservation.status]}
                      label={RESERVATION_STATUS_LABELS[selectedReservation.status]}
                    />
                    {selectedReservation.source !== null && (
                      <Badge colorScheme="gray">{selectedReservation.source}</Badge>
                    )}
                  </HStack>

                  <SimpleGrid columns={2} spacing={3}>
                    <KeyValue
                      label="Check-in"
                      value={formatCalendarDate(selectedReservation.checkInDate)}
                    />
                    <KeyValue
                      label="Check-out"
                      value={formatCalendarDate(selectedReservation.checkOutDate)}
                    />
                    <KeyValue label="Noches" value={selectedReservation.nights} />
                    <KeyValue
                      label="Ocupación"
                      value={`${selectedReservation.adults} adultos · ${selectedReservation.children} menores`}
                    />
                    <KeyValue label="Tipo" value={selectedReservation.roomType.name} />
                    <KeyValue
                      label="Habitación"
                      value={
                        selectedReservation.room !== null
                          ? `Hab. ${selectedReservation.room.number}`
                          : 'Sin asignar'
                      }
                    />
                    <KeyValue label="Huésped" value={selectedReservation.guest.fullName} />
                    <KeyValue
                      label="Contacto"
                      value={
                        selectedReservation.guest.email ?? selectedReservation.guest.phone ?? '—'
                      }
                    />
                  </SimpleGrid>

                  {selectedReservation.notes !== null && (
                    <Box>
                      <Text fontSize="xs" color="gray.500" textTransform="uppercase">
                        Notas
                      </Text>
                      <Text fontSize="sm" whiteSpace="pre-wrap">
                        {selectedReservation.notes}
                      </Text>
                    </Box>
                  )}

                  {selectedReservation.status === 'CONFIRMED' && (
                    <>
                      <Divider />
                      <Box>
                        <Text fontWeight="semibold" mb={2}>
                          Asignar habitación
                        </Text>
                        <HStack>
                          <Select
                            size="sm"
                            placeholder={
                              detailAvailability.loading
                                ? 'Consultando disponibilidad…'
                                : 'Habitación disponible'
                            }
                            value={assignRoomId}
                            onChange={(event) => setAssignRoomId(event.target.value)}
                            isDisabled={detailAvailability.loading}
                          >
                            {detailAvailability.data?.items.map((item) => (
                              <option key={item.roomId} value={item.roomId}>
                                Hab. {item.number} · {item.roomType.name}
                              </option>
                            ))}
                          </Select>
                          <Button
                            size="sm"
                            colorScheme="purple"
                            onClick={() => void handleAssign()}
                            isLoading={saving}
                            isDisabled={assignRoomId === ''}
                          >
                            Asignar
                          </Button>
                        </HStack>
                        {(detailAvailability.data?.items.length ?? 0) === 0 &&
                          !detailAvailability.loading && (
                            <Text fontSize="xs" color="orange.600" mt={2}>
                              No hay habitaciones libres de este tipo para estas fechas.
                            </Text>
                          )}
                      </Box>
                    </>
                  )}

                  {selectedReservation.cancellationReason !== null && (
                    <Box>
                      <Text fontSize="xs" color="gray.500" textTransform="uppercase">
                        Motivo de cancelación
                      </Text>
                      <Text fontSize="sm">{selectedReservation.cancellationReason}</Text>
                      <Text fontSize="xs" color="gray.500">
                        {formatDateTime(selectedReservation.cancelledAt)}
                      </Text>
                    </Box>
                  )}

                  <Divider />
                  <Box>
                    <Text fontWeight="semibold" mb={2}>
                      Historial
                    </Text>
                    <QueryFeedback
                      loading={false}
                      error={null}
                      isEmpty={detail.data?.history.length === 0}
                      emptyText="Sin eventos."
                    >
                      <Stack spacing={2} maxH="320px" overflowY="auto">
                        {detail.data?.history.map((entry) => (
                          <Box key={entry.id} borderLeftWidth="3px" borderColor="purple.200" pl={3}>
                            <Text fontSize="sm" fontWeight="medium">
                              {ACTION_LABELS[entry.action] ?? entry.action}
                            </Text>
                            <Text fontSize="xs" color="gray.500">
                              {formatDateTime(entry.occurredAt)}
                              {entry.toStatus !== null
                                ? ` · ${RESERVATION_STATUS_LABELS[entry.toStatus]}`
                                : ''}
                            </Text>
                            {entry.reason !== null && (
                              <Text fontSize="xs" color="gray.600">
                                {entry.reason}
                              </Text>
                            )}
                          </Box>
                        ))}
                      </Stack>
                    </QueryFeedback>
                  </Box>
                </Stack>
              )}
            </QueryFeedback>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}

export default function ReservationsPage() {
  return (
    <PropertyGate>
      <ReservationsContent />
    </PropertyGate>
  );
}
