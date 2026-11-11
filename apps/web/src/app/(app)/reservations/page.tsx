'use client';

import {
  Badge,
  Box,
  Button,
  Collapse,
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
import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { DownloadIcon } from '@/components/icons';
import {
  Field,
  KeyValue,
  PageHeader,
  QueryFeedback,
  SectionCard,
  StatusBadge,
} from '@/components/ui';
import { useSession } from '@/context/session';
import { api, downloadCsv, errorMessage } from '@/lib/api';
import {
  DOCUMENT_TYPE_LABELS,
  RESERVATION_STATUS_COLORS,
  RESERVATION_STATUS_LABELS,
  formatCalendarDate,
  formatDateTime,
  nightsBetween,
  todayISO,
} from '@/lib/format';
import type {
  Availability,
  AvailabilityItem,
  Guest,
  GuestDocumentType,
  Reservation,
  ReservationHistoryEntry,
  RoomType,
} from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

interface ListData {
  items: Reservation[];
  nextCursor: string | null;
}

interface GuestFormState {
  fullName: string;
  email: string;
  phone: string;
  documentType: '' | GuestDocumentType;
  documentNumber: string;
}

const EMPTY_GUEST_FORM: GuestFormState = {
  fullName: '',
  email: '',
  phone: '',
  documentType: '',
  documentNumber: '',
};

function guestFormFrom(guest: Guest): GuestFormState {
  return {
    fullName: guest.fullName,
    email: guest.email ?? '',
    phone: guest.phone ?? '',
    documentType: guest.documentType ?? '',
    documentNumber: guest.documentNumber ?? '',
  };
}

function guestCreateBody(form: GuestFormState): Record<string, unknown> {
  return {
    fullName: form.fullName.trim(),
    ...(form.email.trim() !== '' ? { email: form.email.trim() } : {}),
    ...(form.phone.trim() !== '' ? { phone: form.phone.trim() } : {}),
    ...(form.documentType !== ''
      ? { documentType: form.documentType, documentNumber: form.documentNumber.trim() }
      : {}),
  };
}

function guestUpdateBody(form: GuestFormState): Record<string, unknown> {
  return {
    fullName: form.fullName.trim(),
    ...(form.email.trim() !== '' ? { email: form.email.trim() } : {}),
    ...(form.phone.trim() !== '' ? { phone: form.phone.trim() } : {}),
    ...(form.documentType === ''
      ? { documentType: null, documentNumber: null }
      : { documentType: form.documentType, documentNumber: form.documentNumber.trim() }),
  };
}

function GuestFields({
  value,
  onChange,
  disabled = false,
  idPrefix,
}: {
  value: GuestFormState;
  onChange: (patch: Partial<GuestFormState>) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  return (
    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
      <Field label="Nombre completo" isRequired>
        <Input
          id={`${idPrefix}-full-name`}
          value={value.fullName}
          onChange={(event) => onChange({ fullName: event.target.value })}
          placeholder="Nombre y apellido"
          isDisabled={disabled}
        />
      </Field>
      <Field label="Email">
        <Input
          id={`${idPrefix}-email`}
          type="email"
          value={value.email}
          onChange={(event) => onChange({ email: event.target.value })}
          placeholder="huesped@ejemplo.com"
          isDisabled={disabled}
        />
      </Field>
      <Field label="Teléfono">
        <Input
          id={`${idPrefix}-phone`}
          value={value.phone}
          onChange={(event) => onChange({ phone: event.target.value })}
          placeholder="+55 11 90000-0000"
          isDisabled={disabled}
        />
      </Field>
      <Field label="Tipo de documento">
        <Select
          id={`${idPrefix}-document-type`}
          value={value.documentType}
          onChange={(event) =>
            onChange({ documentType: event.target.value as '' | GuestDocumentType })
          }
          isDisabled={disabled}
        >
          <option value="">Sin documento</option>
          {(Object.keys(DOCUMENT_TYPE_LABELS) as GuestDocumentType[]).map((type) => (
            <option key={type} value={type}>
              {DOCUMENT_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
      </Field>
      {value.documentType !== '' && (
        <Field label="Número de documento" isRequired>
          <Input
            id={`${idPrefix}-document-number`}
            value={value.documentNumber}
            onChange={(event) => onChange({ documentNumber: event.target.value })}
            placeholder="Número o código"
            isDisabled={disabled}
          />
        </Field>
      )}
    </SimpleGrid>
  );
}

function RoomChoiceGrid({
  items,
  value,
  onChange,
  allowUnassigned = false,
  disabled = false,
}: {
  items: AvailabilityItem[];
  value: string;
  onChange: (roomId: string) => void;
  allowUnassigned?: boolean;
  disabled?: boolean;
}) {
  return (
    <HStack wrap="wrap" spacing={2}>
      {allowUnassigned && (
        <Button
          size="sm"
          variant={value === '' ? 'solid' : 'outline'}
          colorScheme={value === '' ? 'brand' : 'gray'}
          onClick={() => onChange('')}
          isDisabled={disabled}
        >
          Sin asignar
        </Button>
      )}
      {items.map((item) => (
        <Button
          key={item.roomId}
          size="sm"
          variant={value === item.roomId ? 'solid' : 'outline'}
          colorScheme={value === item.roomId ? 'brand' : 'gray'}
          onClick={() => onChange(item.roomId)}
          isDisabled={disabled}
        >
          Hab. {item.number}
          {item.floor !== null ? ` · piso ${item.floor}` : ''}
        </Button>
      ))}
    </HStack>
  );
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
  'reservation.checked_in': 'Check-in',
  'reservation.checked_out': 'Check-out',
  'reservation.room_moved': 'Cambio de habitación',
  'reservation.no_show': 'No-show',
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
  const [exporting, setExporting] = useState(false);

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
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [guestSearch, setGuestSearch] = useState('');
  const [debouncedGuestSearch, setDebouncedGuestSearch] = useState('');
  const [guestPanel, setGuestPanel] = useState<'none' | 'create'>('none');
  const [guestForm, setGuestForm] = useState<GuestFormState>(EMPTY_GUEST_FORM);
  const [guestSaving, setGuestSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const guestEditModal = useDisclosure();
  const [guestEditTarget, setGuestEditTarget] = useState<Guest | null>(null);
  const [guestEditSource, setGuestEditSource] = useState<'create' | 'detail'>('create');
  const [guestEditForm, setGuestEditForm] = useState<GuestFormState>(EMPTY_GUEST_FORM);

  const [editForm, setEditForm] = useState({
    checkInDate: '',
    checkOutDate: '',
    adults: '1',
    children: '0',
    notes: '',
  });
  const [cancelReason, setCancelReason] = useState('');
  const [assignRoomId, setAssignRoomId] = useState('');

  const lookup = useAsyncData<{ roomTypes: RoomType[] }>(
    async () => {
      if (!createModal.isOpen) {
        return { roomTypes: [] };
      }
      const roomTypes = await api<{ items: RoomType[] }>(
        '/api/v1/inventory/room-types?status=ACTIVE',
        { tenant },
      );
      return { roomTypes: roomTypes.items };
    },
    `${tenant.organizationId}:${tenant.propertyId}:room-types:${String(createModal.isOpen)}`,
  );

  const guestLookup = useAsyncData<{ items: Guest[] }>(
    async () => {
      if (!createModal.isOpen) {
        return { items: [] };
      }
      const params = new URLSearchParams({ status: 'ACTIVE', limit: '8' });
      if (debouncedGuestSearch !== '') params.set('search', debouncedGuestSearch);
      return api<{ items: Guest[] }>(`/api/v1/guests?${params.toString()}`, { tenant });
    },
    `${tenant.organizationId}:${tenant.propertyId}:guest-search:${String(createModal.isOpen)}:${debouncedGuestSearch}`,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedGuestSearch(guestSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [guestSearch]);

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

  const detail = useAsyncData<{
    reservation: Reservation;
    history: ReservationHistoryEntry[];
    guest: Guest;
  }>(
    async () => {
      if (selectedId === null) {
        throw new Error('Sin reserva seleccionada');
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
  const today = todayISO();
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
    setSelectedGuest(null);
    setGuestSearch('');
    setDebouncedGuestSearch('');
    setGuestPanel('none');
    setGuestForm(EMPTY_GUEST_FORM);
    setShowDetails(false);
    createModal.onOpen();
  }

  const openedFromQuery = useRef(false);
  const openCreateRef = useRef(openCreate);
  openCreateRef.current = openCreate;
  useEffect(() => {
    if (openedFromQuery.current) {
      return;
    }
    openedFromQuery.current = true;
    if (new URLSearchParams(window.location.search).get('new') === '1') {
      openCreateRef.current();
    }
  }, []);

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

  function selectGuest(guest: Guest): void {
    setSelectedGuest(guest);
    setCreateForm((current) => ({ ...current, guestId: guest.id }));
    setGuestPanel('none');
    setGuestSearch('');
  }

  async function handleCreateGuest(): Promise<void> {
    const fullName = guestForm.fullName.trim();
    if (fullName.length < 2) {
      toast({ title: 'El nombre debe tener al menos 2 caracteres', status: 'warning' });
      return;
    }
    if (guestForm.documentType !== '' && guestForm.documentNumber.trim().length < 3) {
      toast({ title: 'Completá el número de documento', status: 'warning' });
      return;
    }
    setGuestSaving(true);
    try {
      const guest = await api<Guest>('/api/v1/guests', {
        method: 'POST',
        tenant,
        body: guestCreateBody(guestForm),
      });
      selectGuest(guest);
      setGuestForm(EMPTY_GUEST_FORM);
      toast({ title: 'Huésped creado y seleccionado', status: 'success' });
    } catch (cause) {
      toast({
        title: 'No se pudo crear el huésped',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setGuestSaving(false);
    }
  }

  function openGuestEdit(guest: Guest, source: 'create' | 'detail'): void {
    setGuestEditTarget(guest);
    setGuestEditSource(source);
    setGuestEditForm(guestFormFrom(guest));
    guestEditModal.onOpen();
  }

  async function handleGuestEdit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (guestEditTarget === null) {
      return;
    }
    if (guestEditForm.fullName.trim().length < 2) {
      toast({ title: 'El nombre debe tener al menos 2 caracteres', status: 'warning' });
      return;
    }
    if (guestEditForm.documentType !== '' && guestEditForm.documentNumber.trim().length < 3) {
      toast({ title: 'Completá el número de documento', status: 'warning' });
      return;
    }
    setGuestSaving(true);
    try {
      const guest = await api<Guest>(`/api/v1/guests/${guestEditTarget.id}`, {
        method: 'PATCH',
        tenant,
        body: guestUpdateBody(guestEditForm),
      });
      if (guestEditSource === 'create' && selectedGuest?.id === guest.id) {
        setSelectedGuest(guest);
      }
      toast({ title: 'Datos del huésped actualizados', status: 'success' });
      guestEditModal.onClose();
      if (guestEditSource === 'detail') {
        bumpDetail();
      }
      reload();
    } catch (cause) {
      toast({
        title: 'No se pudieron guardar los datos',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setGuestSaving(false);
    }
  }

  async function handleCheckIn(reservation: Reservation): Promise<void> {
    setSaving(true);
    try {
      await api(`/api/v1/front-office/reservations/${reservation.id}/check-in`, {
        method: 'POST',
        tenant,
      });
      toast({ title: 'Check-in realizado', status: 'success' });
      reload();
      bumpDetail();
    } catch (cause) {
      toast({
        title: 'No se pudo hacer check-in',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  async function exportReservations(): Promise<void> {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.search !== '') params.set('search', filters.search);
      if (filters.status !== '') params.set('status', filters.status);
      if (filters.fromDate !== '') params.set('fromDate', filters.fromDate);
      if (filters.toDate !== '') params.set('toDate', filters.toDate);
      await downloadCsv(
        `/api/v1/exports/reservations?${params.toString()}`,
        tenant,
        `reservas-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      toast({ title: 'Exportación descargada', status: 'success' });
    } catch (cause) {
      toast({
        title: 'No se pudo exportar',
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Reservas"
        description="Estadías por fecha calendario con estancia [check-in, check-out) y una habitación por reserva. Los solapamientos los impide PostgreSQL."
        actions={
          <HStack spacing={2}>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<DownloadIcon boxSize={4} />}
              onClick={() => void exportReservations()}
              isLoading={exporting}
            >
              Exportar CSV
            </Button>
            <Button colorScheme="brand" size="sm" onClick={openCreate}>
              Nueva reserva
            </Button>
          </HStack>
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
                              colorScheme="danger"
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
      <Modal
        isOpen={createModal.isOpen}
        onClose={createModal.onClose}
        size="4xl"
        scrollBehavior="inside"
      >
        <ModalOverlay />{' '}
        <ModalContent
          as="form"
          my={4}
          maxH="calc(100vh - 2rem)"
          onSubmit={(event) => void handleCreate(event)}
        >
          <ModalHeader>Nueva reserva</ModalHeader>
          <ModalCloseButton />
          <ModalBody py={4}>
            <Stack spacing={4}>
              <Box>
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="semibold">Huésped</Text>
                  {selectedGuest === null && guestPanel === 'none' && (
                    <Button
                      size="xs"
                      variant="ghost"
                      colorScheme="brand"
                      onClick={() => {
                        setGuestForm({ ...EMPTY_GUEST_FORM, fullName: guestSearch.trim() });
                        setGuestPanel('create');
                      }}
                    >
                      + Nuevo huésped
                    </Button>
                  )}
                </HStack>

                {selectedGuest !== null ? (
                  <Box borderWidth="1px" borderColor="line" borderRadius="md" p={3} bg="gray.50">
                    <HStack justify="space-between" align="flex-start" wrap="wrap" spacing={3}>
                      <Box minW={0}>
                        <Text fontWeight="semibold">{selectedGuest.fullName}</Text>
                        <Text fontSize="xs" color="gray.600" isTruncated>
                          {[selectedGuest.email, selectedGuest.phone].filter(Boolean).join(' · ') ||
                            'Sin datos de contacto'}
                        </Text>
                        <Text fontSize="xs" color="gray.600">
                          {selectedGuest.documentType !== null
                            ? `${DOCUMENT_TYPE_LABELS[selectedGuest.documentType]} ${selectedGuest.documentNumber ?? ''}`
                            : 'Sin documento'}
                        </Text>
                      </Box>
                      <HStack spacing={2}>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => openGuestEdit(selectedGuest, 'create')}
                        >
                          Editar datos
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setSelectedGuest(null);
                            setCreateForm((current) => ({ ...current, guestId: '' }));
                            setGuestSearch('');
                          }}
                        >
                          Cambiar
                        </Button>
                      </HStack>
                    </HStack>
                  </Box>
                ) : guestPanel === 'create' ? (
                  <Box borderWidth="1px" borderColor="line" borderRadius="md" p={3}>
                    <GuestFields
                      value={guestForm}
                      onChange={(patch) => setGuestForm((current) => ({ ...current, ...patch }))}
                      disabled={guestSaving}
                      idPrefix="new-reservation-guest"
                    />
                    <HStack justify="flex-end" mt={3}>
                      <Button size="sm" variant="ghost" onClick={() => setGuestPanel('none')}>
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        colorScheme="brand"
                        onClick={() => void handleCreateGuest()}
                        isLoading={guestSaving}
                      >
                        Crear y seleccionar
                      </Button>
                    </HStack>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    <Input
                      aria-label="Buscar huésped"
                      placeholder="Buscar por nombre, email o teléfono…"
                      value={guestSearch}
                      onChange={(event) => setGuestSearch(event.target.value)}
                    />
                    <Box
                      borderWidth="1px"
                      borderColor="line"
                      borderRadius="md"
                      maxH="150px"
                      overflowY="auto"
                    >
                      {guestLookup.loading ? (
                        <Text px={3} py={2} fontSize="sm" color="gray.500">
                          Buscando huéspedes…
                        </Text>
                      ) : (guestLookup.data?.items.length ?? 0) === 0 ? (
                        <Text px={3} py={2} fontSize="sm" color="gray.500">
                          No hay huéspedes activos
                          {debouncedGuestSearch !== '' ? ` para “${debouncedGuestSearch}”` : ''}.
                        </Text>
                      ) : (
                        <Stack spacing={0} divider={<Divider />}>
                          {guestLookup.data?.items.map((guest) => (
                            <Button
                              key={guest.id}
                              variant="ghost"
                              justifyContent="flex-start"
                              h="auto"
                              py={2}
                              px={3}
                              borderRadius="none"
                              onClick={() => selectGuest(guest)}
                            >
                              <Box textAlign="left" minW={0}>
                                <Text fontSize="sm" fontWeight="medium" isTruncated>
                                  {guest.fullName}
                                </Text>
                                <Text fontSize="xs" color="gray.500" isTruncated>
                                  {[guest.email, guest.phone].filter(Boolean).join(' · ') ||
                                    'Sin datos de contacto'}
                                </Text>
                              </Box>
                            </Button>
                          ))}
                        </Stack>
                      )}
                    </Box>
                    {guestLookup.error !== null && (
                      <Text fontSize="xs" color="danger.500">
                        {errorMessage(guestLookup.error)}
                      </Text>
                    )}
                    <Button
                      size="xs"
                      variant="link"
                      alignSelf="flex-start"
                      onClick={() => {
                        setGuestForm({ ...EMPTY_GUEST_FORM, fullName: guestSearch.trim() });
                        setGuestPanel('create');
                      }}
                    >
                      Crear un huésped nuevo
                      {guestSearch.trim() !== '' ? ` con “${guestSearch.trim()}”` : ''}
                    </Button>
                  </Stack>
                )}
              </Box>

              <Box>
                <Text fontWeight="semibold" mb={2}>
                  Estadía
                </Text>
                <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                  <Field label="Check-in" isRequired>
                    <Input
                      type="date"
                      value={createForm.checkInDate}
                      min={todayISO()}
                      onChange={(event) =>
                        setCreateForm({
                          ...createForm,
                          checkInDate: event.target.value,
                          roomId: '',
                        })
                      }
                      required
                    />
                  </Field>
                  <Field label="Check-out" isRequired>
                    <Input
                      type="date"
                      value={createForm.checkOutDate}
                      min={createForm.checkInDate}
                      onChange={(event) =>
                        setCreateForm({
                          ...createForm,
                          checkOutDate: event.target.value,
                          roomId: '',
                        })
                      }
                      required
                    />
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
                <Text mt={2} fontSize="xs" color={createDatesValid ? 'gray.600' : 'danger.500'}>
                  {createDatesValid
                    ? `${createNights} ${createNights === 1 ? 'noche' : 'noches'} · la noche de check-out no se ocupa`
                    : 'La estadía debe tener entre 1 y 366 noches.'}
                </Text>
              </Box>

              <Box>
                <Text fontWeight="semibold" mb={2}>
                  Habitación
                </Text>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
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
                  <Box alignSelf="end">
                    <Text fontSize="xs" color="gray.500">
                      {createForm.roomTypeId === ''
                        ? 'Elegí un tipo para ver las habitaciones libres.'
                        : 'Asignar habitación ahora es opcional; podés hacerlo al llegar.'}
                    </Text>
                  </Box>
                </SimpleGrid>

                {createForm.roomTypeId !== '' && createDatesValid && (
                  <Box mt={3}>
                    {availability.loading ? (
                      <Text fontSize="sm" color="gray.500">
                        Consultando disponibilidad…
                      </Text>
                    ) : availability.error !== null ? (
                      <Text fontSize="sm" color="danger.500">
                        {errorMessage(availability.error)}
                      </Text>
                    ) : (availability.data?.items.length ?? 0) === 0 ? (
                      <Text fontSize="sm" color="warning.600">
                        No hay habitaciones libres de este tipo para el rango elegido.
                      </Text>
                    ) : (
                      <Box>
                        <Text fontSize="xs" color="gray.500" mb={2}>
                          {availability.data?.items.length}{' '}
                          {availability.data?.items.length === 1
                            ? 'habitación disponible'
                            : 'habitaciones disponibles'}
                        </Text>
                        <RoomChoiceGrid
                          items={availability.data?.items ?? []}
                          value={createForm.roomId}
                          onChange={(roomId) =>
                            setCreateForm((current) => ({ ...current, roomId }))
                          }
                          allowUnassigned
                        />
                      </Box>
                    )}
                  </Box>
                )}
              </Box>

              <Box>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setShowDetails((current) => !current)}
                  aria-expanded={showDetails}
                >
                  {showDetails ? 'Ocultar datos opcionales' : '+ Código, origen o notas'}
                </Button>
                <Collapse in={showDetails} animateOpacity>
                  <Box pt={3}>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                      <Field label="Código" helper="Opcional: 4–32 mayúsculas, números o guiones.">
                        <Input
                          value={createForm.code}
                          onChange={(event) =>
                            setCreateForm({ ...createForm, code: event.target.value })
                          }
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
                        mt={3}
                        rows={2}
                        value={createForm.notes}
                        onChange={(event) =>
                          setCreateForm({ ...createForm, notes: event.target.value })
                        }
                      />
                    </Field>
                  </Box>
                </Collapse>
              </Box>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={createModal.onClose}>
              Cancelar
            </Button>
            <Button type="submit" colorScheme="brand" isLoading={saving}>
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
            <Button type="submit" colorScheme="brand" isLoading={saving}>
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
            <Button type="submit" colorScheme="danger" isLoading={saving}>
              Confirmar cancelación
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit guest data from the reservation flow */}
      <Modal isOpen={guestEditModal.isOpen} onClose={guestEditModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleGuestEdit(event)}>
          <ModalHeader>Editar datos del huésped</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Text fontSize="sm" color="gray.600">
                Los cambios se guardan en el perfil del huésped y quedan disponibles para futuras
                reservas y check-ins.
              </Text>
              <GuestFields
                value={guestEditForm}
                onChange={(patch) => setGuestEditForm((current) => ({ ...current, ...patch }))}
                disabled={guestSaving}
                idPrefix="edit-reservation-guest"
              />
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={guestEditModal.onClose}>
              Cancelar
            </Button>
            <Button type="submit" colorScheme="brand" isLoading={guestSaving}>
              Guardar datos
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
                    <KeyValue
                      label="Documento"
                      value={
                        detailGuest?.documentType != null
                          ? `${DOCUMENT_TYPE_LABELS[detailGuest.documentType]} ${detailGuest.documentNumber ?? ''}`
                          : 'Sin documento'
                      }
                    />
                  </SimpleGrid>
                  {detailGuest !== null && (
                    <Button
                      size="xs"
                      variant="outline"
                      alignSelf="flex-start"
                      onClick={() => openGuestEdit(detailGuest, 'detail')}
                    >
                      Editar datos del huésped
                    </Button>
                  )}

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
                          Habitación
                        </Text>
                        {detailAvailability.loading ? (
                          <Text fontSize="sm" color="gray.500">
                            Consultando disponibilidad…
                          </Text>
                        ) : detailAvailability.error !== null ? (
                          <Text fontSize="sm" color="danger.500">
                            {errorMessage(detailAvailability.error)}
                          </Text>
                        ) : (detailAvailability.data?.items.length ?? 0) === 0 ? (
                          <Text fontSize="sm" color="warning.600">
                            No hay habitaciones libres de este tipo para estas fechas.
                          </Text>
                        ) : (
                          <RoomChoiceGrid
                            items={detailAvailability.data?.items ?? []}
                            value={assignRoomId}
                            onChange={setAssignRoomId}
                            disabled={saving}
                          />
                        )}
                        <HStack mt={3} spacing={2} wrap="wrap">
                          <Button
                            size="sm"
                            colorScheme="brand"
                            onClick={() => void handleAssign()}
                            isLoading={saving}
                            isDisabled={assignRoomId === ''}
                          >
                            Asignar seleccionada
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            colorScheme="brand"
                            onClick={() => void handleCheckIn(selectedReservation)}
                            isDisabled={
                              selectedReservation.room === null ||
                              !checkInEligible ||
                              saving ||
                              detailAvailability.loading
                            }
                          >
                            Hacer check-in
                          </Button>
                        </HStack>
                        {selectedReservation.room === null && (
                          <Text fontSize="xs" color="gray.500" mt={2}>
                            Asigná una habitación para habilitar el check-in.
                          </Text>
                        )}
                        {selectedReservation.room !== null && !checkInEligible && (
                          <Text fontSize="xs" color="gray.500" mt={2}>
                            El check-in se habilita desde el día de llegada.
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
                          <Box key={entry.id} borderLeftWidth="3px" borderColor="brand.200" pl={3}>
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
