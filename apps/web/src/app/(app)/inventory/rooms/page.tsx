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
import { useEffect, useReducer, useState, type FormEvent } from 'react';
import { PropertyGate } from '@/components/app-shell';
import {
  Field,
  KeyValue,
  PageHeader,
  QueryFeedback,
  SectionCard,
  StatusBadge,
} from '@/components/ui';
import { RowActionButton } from '@/components/ui';
import { useSession } from '@/context/session';
import { api, apiEventStream, errorMessage } from '@/lib/api';
import {
  BLOCK_STATUS_LABELS,
  BLOCK_TYPE_LABELS,
  HOUSEKEEPING_COLORS,
  HOUSEKEEPING_LABELS,
  HOUSEKEEPING_TRANSITIONS,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_TYPE_LABELS,
  OCCUPANCY_COLORS,
  OCCUPANCY_LABELS,
  OPERATIONAL_COLORS,
  OPERATIONAL_LABELS,
  RECORD_STATUS_COLORS,
  RECORD_STATUS_LABELS,
  formatDateTime,
  formatCalendarDate,
  splitAttributes,
} from '@/lib/format';
import type {
  HousekeepingState,
  IncidentSeverity,
  IncidentType,
  Room,
  RoomAssignmentLease,
  RoomBlock,
  RoomHistoryEntry,
  RoomListFacets,
  RoomListResponse,
  RoomListSummary,
  RoomOperationalState,
  RoomType,
} from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import {
  blockRangeField,
  buildErrors,
  datetimeLocalField,
  hasErrors,
  reasonField,
  validateRoom,
  type FieldErrors,
} from '@/lib/validation';

interface RoomsData {
  rooms: Room[];
  roomTypes: RoomType[];
  summary: RoomListSummary;
  facets: RoomListFacets;
}

interface RoomForm {
  number: string;
  roomTypeId: string;
  floor: string;
  building: string;
  attributes: string;
  status: 'ACTIVE' | 'DISABLED';
}

function localDateTimeInput(offsetHours = 0): string {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function RoomsContent() {
  const { tenant, actor } = useSession();
  const toast = useToast();

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    roomTypeId: '',
    floor: '',
    building: '',
    minCapacity: '',
    occupancy: '',
    operationalState: '',
    housekeepingState: '',
  });

  const { data, loading, error, reload, reloadSilent } = useAsyncData<RoomsData>(
    async () => {
      const params = new URLSearchParams();
      if (filters.search !== '') params.set('search', filters.search);
      if (filters.roomTypeId !== '') params.set('roomTypeId', filters.roomTypeId);
      if (filters.floor !== '') params.set('floor', filters.floor);
      if (filters.building !== '') params.set('building', filters.building);
      if (filters.minCapacity !== '') params.set('minCapacity', filters.minCapacity);
      if (filters.occupancy !== '') params.set('occupancy', filters.occupancy);
      if (filters.operationalState !== '') params.set('operationalState', filters.operationalState);
      if (filters.housekeepingState !== '')
        params.set('housekeepingState', filters.housekeepingState);
      params.set('limit', '100');

      const [rooms, roomTypes] = await Promise.all([
        api<RoomListResponse>(`/api/v1/inventory/rooms?${params.toString()}`, { tenant }),
        api<{ items: RoomType[] }>('/api/v1/inventory/room-types?status=ACTIVE', { tenant }),
      ]);
      return {
        rooms: rooms.items,
        roomTypes: roomTypes.items,
        summary: rooms.summary,
        facets: rooms.facets,
      };
    },
    `${tenant.organizationId}:${tenant.propertyId}:rooms:${JSON.stringify(filters)}`,
  );

  // The SSE stream refreshes the rack as soon as another session changes a
  // room. When it cannot connect, polling every 15s keeps the rack usable.
  const [liveMode, setLiveMode] = useState<'connecting' | 'live' | 'polling'>('connecting');
  const organizationId = tenant.organizationId;
  const propertyId = tenant.propertyId;

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let attempts = 0;
    let retryTimer: number | undefined;
    let refreshTimer: number | undefined;

    function scheduleRefresh(): void {
      if (refreshTimer !== undefined) {
        window.clearTimeout(refreshTimer);
      }
      refreshTimer = window.setTimeout(() => {
        refreshTimer = undefined;
        reloadSilent();
      }, 250);
    }

    async function run(): Promise<void> {
      try {
        setLiveMode('connecting');
        for await (const event of apiEventStream(
          '/api/v1/inventory/rooms/updates',
          { organizationId, propertyId },
          controller.signal,
        )) {
          attempts = 0;
          setLiveMode('live');
          if (
            event.type === 'ready' ||
            event.type === 'room.updated' ||
            event.type === 'room.housekeeping' ||
            event.type === 'room.block_changed' ||
            event.type === 'room.lease_changed'
          ) {
            scheduleRefresh();
          }
        }
      } catch {
        // Offline, expired session or a proxy that buffers streams.
      }
      if (disposed) {
        return;
      }
      setLiveMode('polling');
      attempts += 1;
      retryTimer = window.setTimeout(
        () => {
          retryTimer = undefined;
          void run();
        },
        Math.min(2_000 * attempts, 30_000),
      );
    }

    void run();

    return () => {
      disposed = true;
      controller.abort();
      if (retryTimer !== undefined) {
        window.clearTimeout(retryTimer);
      }
      if (refreshTimer !== undefined) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, [organizationId, propertyId, reloadSilent]);

  useEffect(() => {
    if (liveMode === 'live') {
      return undefined;
    }
    const timer = window.setInterval(() => reloadSilent(), 15_000);
    return () => window.clearInterval(timer);
  }, [liveMode, reloadSilent]);

  const createModal = useDisclosure();
  const editModal = useDisclosure();
  const drawer = useDisclosure();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [detailVersion, bumpDetail] = useReducer((value: number) => value + 1, 0);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [blockSaving, setBlockSaving] = useState(false);
  const [leaseBusy, setLeaseBusy] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const [forceReason, setForceReason] = useState('');
  const [incidentSaving, setIncidentSaving] = useState(false);
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [blockErrors, setBlockErrors] = useState<FieldErrors>({});

  const [createForm, setCreateForm] = useState<RoomForm>({
    number: '',
    roomTypeId: '',
    floor: '',
    building: '',
    attributes: '',
    status: 'ACTIVE',
  });
  const [editForm, setEditForm] = useState<RoomForm>({
    number: '',
    roomTypeId: '',
    floor: '',
    building: '',
    attributes: '',
    status: 'ACTIVE',
  });
  const [blockForm, setBlockForm] = useState({
    type: 'OUT_OF_ORDER',
    reason: '',
    startsAt: localDateTimeInput(),
    endsAt: localDateTimeInput(24),
  });
  const [transitionReason, setTransitionReason] = useState('');
  const [incidentForm, setIncidentForm] = useState<{
    type: IncidentType;
    severity: IncidentSeverity;
    title: string;
    description: string;
  }>({ type: 'NOTE', severity: 'MEDIUM', title: '', description: '' });

  const selectedRoom = data?.rooms.find((room) => room.id === selectedRoomId) ?? null;

  const detail = useAsyncData<{ blocks: RoomBlock[]; history: RoomHistoryEntry[] }>(
    async () => {
      if (selectedRoomId === null) {
        return { blocks: [], history: [] };
      }
      const [blocks, history] = await Promise.all([
        api<{ items: RoomBlock[] }>(`/api/v1/inventory/rooms/${selectedRoomId}/blocks`, { tenant }),
        api<{ items: RoomHistoryEntry[] }>(`/api/v1/inventory/rooms/${selectedRoomId}/history`, {
          tenant,
        }),
      ]);
      return { blocks: blocks.items, history: history.items };
    },
    `${selectedRoomId ?? 'none'}:${detailVersion}`,
  );

  useEffect(() => {
    if (data !== null && createForm.roomTypeId === '' && data.roomTypes[0] !== undefined) {
      setCreateForm((current) => ({ ...current, roomTypeId: data.roomTypes[0]!.id }));
    }
  }, [data, createForm.roomTypeId]);

  function openDetail(room: Room): void {
    setSelectedRoomId(room.id);
    setTransitionReason('');
    setIncidentForm({ type: 'NOTE', severity: 'MEDIUM', title: '', description: '' });
    setBlockForm({
      type: 'OUT_OF_ORDER',
      reason: '',
      startsAt: localDateTimeInput(),
      endsAt: localDateTimeInput(24),
    });
    setBlockErrors({});
    drawer.onOpen();
  }

  function openEdit(room: Room): void {
    setSelectedRoomId(room.id);
    setEditForm({
      number: room.number,
      roomTypeId: room.roomTypeId,
      floor: room.floor ?? '',
      building: room.building ?? '',
      attributes: room.attributes.join(', '),
      status: room.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
    });
    setEditErrors({});
    editModal.onOpen();
  }

  async function handleCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    const nextErrors = validateRoom(createForm);
    setCreateErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    try {
      await api<Room>('/api/v1/inventory/rooms', {
        method: 'POST',
        tenant,
        body: {
          number: createForm.number.trim(),
          roomTypeId: createForm.roomTypeId,
          ...(createForm.floor.trim() !== '' ? { floor: createForm.floor.trim() } : {}),
          ...(createForm.building.trim() !== '' ? { building: createForm.building.trim() } : {}),
          attributes: splitAttributes(createForm.attributes),
        },
      });
      toast({ title: 'Habitación creada', status: 'success' });
      createModal.onClose();
      setCreateForm({
        number: '',
        roomTypeId: data?.roomTypes[0]?.id ?? '',
        floor: '',
        building: '',
        attributes: '',
        status: 'ACTIVE',
      });
      reload();
    } catch (cause) {
      toast({
        title: 'No se pudo crear la habitación',
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (selectedRoomId === null) {
      return;
    }
    const nextErrors = validateRoom(editForm);
    setEditErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    try {
      await api<Room>(`/api/v1/inventory/rooms/${selectedRoomId}`, {
        method: 'PATCH',
        tenant,
        body: {
          number: editForm.number.trim(),
          roomTypeId: editForm.roomTypeId,
          // Empty optional fields are omitted, matching the create payload and
          // avoiding a 400 from @Length(1,32) on an empty string.
          ...(editForm.floor.trim() !== '' ? { floor: editForm.floor.trim() } : {}),
          ...(editForm.building.trim() !== '' ? { building: editForm.building.trim() } : {}),
          attributes: splitAttributes(editForm.attributes),
          status: editForm.status,
        },
      });
      toast({ title: 'Habitación actualizada', status: 'success' });
      editModal.onClose();
      reload();
      bumpDetail();
    } catch (cause) {
      toast({
        title: 'No se pudo actualizar',
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setSaving(false);
    }
  }

  async function transitionHousekeeping(state: HousekeepingState): Promise<void> {
    if (selectedRoomId === null) {
      return;
    }
    setTransitioning(true);
    try {
      await api<Room>(`/api/v1/inventory/rooms/${selectedRoomId}/housekeeping-transitions`, {
        method: 'POST',
        tenant,
        body: {
          state,
          ...(transitionReason.trim() !== '' ? { reason: transitionReason.trim() } : {}),
        },
      });
      toast({ title: `Housekeeping: ${HOUSEKEEPING_LABELS[state]}`, status: 'success' });
      setTransitionReason('');
      reload();
      bumpDetail();
    } catch (cause) {
      toast({
        title: 'Transición rechazada',
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setTransitioning(false);
    }
  }

  function blockFormErrors(form: {
    reason: string;
    startsAt: string;
    endsAt: string;
  }): FieldErrors {
    return buildErrors([
      ['reason', reasonField(form.reason)],
      ['startsAt', datetimeLocalField(form.startsAt, 'El inicio del bloqueo')],
      [
        'endsAt',
        datetimeLocalField(form.endsAt, 'El fin del bloqueo') ??
          blockRangeField(form.startsAt, form.endsAt),
      ],
    ]);
  }

  async function createBlock(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (selectedRoomId === null) {
      return;
    }
    const nextErrors = blockFormErrors(blockForm);
    setBlockErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setBlockSaving(true);
    try {
      await api<RoomBlock>(`/api/v1/inventory/rooms/${selectedRoomId}/blocks`, {
        method: 'POST',
        tenant,
        body: {
          type: blockForm.type,
          reason: blockForm.reason.trim(),
          startsAt: new Date(blockForm.startsAt).toISOString(),
          endsAt: new Date(blockForm.endsAt).toISOString(),
        },
      });
      toast({ title: 'Bloqueo creado', status: 'success' });
      setBlockForm({ ...blockForm, reason: '' });
      reload();
      bumpDetail();
    } catch (cause) {
      toast({
        title: 'No se pudo crear el bloqueo',
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setBlockSaving(false);
    }
  }

  async function releaseBlock(block: RoomBlock): Promise<void> {
    if (selectedRoomId === null) {
      return;
    }
    const reason = window.prompt('Motivo de liberación (opcional)', 'Liberado desde la UI');
    if (reason === null) {
      return;
    }
    try {
      await api<RoomBlock>(`/api/v1/inventory/rooms/${selectedRoomId}/blocks/${block.id}/release`, {
        method: 'POST',
        tenant,
        body: reason.trim() === '' ? {} : { reason: reason.trim() },
      });
      toast({ title: 'Bloqueo liberado', status: 'success' });
      reload();
      bumpDetail();
    } catch (cause) {
      toast({ title: 'No se pudo liberar', description: errorMessage(cause), status: 'error' });
    }
  }

  async function createIncident(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (selectedRoomId === null) {
      return;
    }
    if (incidentForm.title.trim().length < 3 || incidentForm.description.trim().length < 3) {
      toast({ title: 'Completá título y descripción', status: 'warning' });
      return;
    }
    setIncidentSaving(true);
    try {
      await api('/api/v1/front-office/incidents', {
        method: 'POST',
        tenant,
        body: {
          roomId: selectedRoomId,
          type: incidentForm.type,
          severity: incidentForm.severity,
          title: incidentForm.title.trim(),
          description: incidentForm.description.trim(),
        },
      });
      toast({ title: 'Incidencia registrada', status: 'success' });
      setIncidentForm({ type: 'NOTE', severity: 'MEDIUM', title: '', description: '' });
    } catch (cause) {
      toast({
        title: 'No se pudo registrar la incidencia',
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
    } finally {
      setIncidentSaving(false);
    }
  }

  async function acquireLease(): Promise<void> {
    if (selectedRoomId === null) {
      return;
    }
    setLeaseBusy(true);
    try {
      await api<RoomAssignmentLease>(
        `/api/v1/inventory/rooms/${selectedRoomId}/assignment-leases`,
        { method: 'POST', tenant, body: {} },
      );
      toast({ title: 'Selección tomada', status: 'success' });
      reloadSilent();
      bumpDetail();
    } catch (cause) {
      toast({
        title: 'No se pudo tomar la selección',
        description: errorMessage(cause),
        status: 'error',
        duration: 7000,
      });
      reloadSilent();
    } finally {
      setLeaseBusy(false);
    }
  }

  async function renewLease(): Promise<void> {
    const lease = selectedRoom?.lease;
    if (selectedRoomId === null || lease === null || lease === undefined) {
      return;
    }
    setLeaseBusy(true);
    try {
      await api<RoomAssignmentLease>(
        `/api/v1/inventory/rooms/${selectedRoomId}/assignment-leases/${lease.leaseId}/renew`,
        { method: 'POST', tenant },
      );
      toast({ title: 'Selección renovada', status: 'success' });
      reloadSilent();
    } catch (cause) {
      toast({ title: 'No se pudo renovar', description: errorMessage(cause), status: 'error' });
      reloadSilent();
    } finally {
      setLeaseBusy(false);
    }
  }

  async function forceReleaseLease(): Promise<void> {
    const lease = selectedRoom?.lease;
    if (selectedRoomId === null || lease === null || lease === undefined) {
      return;
    }
    if (forceReason.trim() === '') {
      setForceOpen(true);
      return;
    }
    setLeaseBusy(true);
    try {
      await api<{ released: boolean }>(`/api/v1/inventory/rooms/${selectedRoomId}/lease-release`, {
        method: 'POST',
        tenant,
        body: { leaseId: lease.leaseId, reason: forceReason.trim() },
      });
      toast({
        title: 'Selección liberada',
        description: 'Se registró el motivo en la auditoría.',
        status: 'success',
      });
      setForceReason('');
      setForceOpen(false);
      reloadSilent();
    } catch (cause) {
      toast({
        title: 'No se pudo liberar la selección',
        description: errorMessage(cause),
        status: 'error',
      });
      reloadSilent();
    } finally {
      setLeaseBusy(false);
    }
  }

  async function releaseLease(): Promise<void> {
    const lease = selectedRoom?.lease;
    if (selectedRoomId === null || lease === null || lease === undefined) {
      return;
    }
    setLeaseBusy(true);
    try {
      await api<void>(
        `/api/v1/inventory/rooms/${selectedRoomId}/assignment-leases/${lease.leaseId}`,
        { method: 'DELETE', tenant },
      );
      toast({ title: 'Selección liberada', status: 'success' });
      reloadSilent();
    } catch (cause) {
      toast({ title: 'No se pudo liberar', description: errorMessage(cause), status: 'error' });
      reloadSilent();
    } finally {
      setLeaseBusy(false);
    }
  }

  const nextHousekeeping =
    selectedRoom !== null ? HOUSEKEEPING_TRANSITIONS[selectedRoom.housekeepingState] : [];
  const summaryCards = [
    { label: 'Libres', value: data?.summary.vacant ?? 0, color: 'mint.600' },
    { label: 'Ocupadas', value: data?.summary.occupied ?? 0, color: 'brand.600' },
    { label: 'Limpias', value: data?.summary.clean ?? 0, color: 'sky.600' },
    { label: 'Sucias', value: data?.summary.dirty ?? 0, color: 'danger.500' },
    { label: 'En limpieza', value: data?.summary.cleaning ?? 0, color: 'warning.500' },
    { label: 'Inspeccionadas', value: data?.summary.inspected ?? 0, color: 'mint.600' },
    { label: 'Fuera de orden', value: data?.summary.outOfOrder ?? 0, color: 'danger.500' },
    { label: 'Fuera de servicio', value: data?.summary.outOfService ?? 0, color: 'warning.500' },
  ];

  return (
    <>
      <PageHeader
        title="Habitaciones"
        description="Inventario físico, housekeeping, bloqueos e historial. Housekeeping y estado operativo son dimensiones separadas."
        actions={
          <Button
            colorScheme="brand"
            size="sm"
            onClick={() => {
              setCreateErrors({});
              createModal.onOpen();
            }}
          >
            Nueva habitación
          </Button>
        }
      />

      <SectionCard>
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mb={4}>
          {summaryCards.map((card) => (
            <Box key={card.label} borderWidth="1px" borderRadius="md" px={3} py={2}>
              <Text fontSize="xs" color="textSecondary">
                {card.label}
              </Text>
              <Text fontSize="xl" fontWeight="semibold" color={card.color}>
                {card.value}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
        <Text fontSize="xs" color="textSecondary" mb={3}>
          {data?.summary.totalRooms ?? 0} habitaciones activas en la propiedad. Los contadores no
          dependen de los filtros.
        </Text>
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
                  width="220px"
                  placeholder="Número, piso, edificio…"
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
              width="180px"
              aria-label="Tipo de habitación"
              value={filters.roomTypeId}
              onChange={(event) => setFilters({ ...filters, roomTypeId: event.target.value })}
            >
              <option value="">Todos los tipos</option>
              {data?.roomTypes.map((roomType) => (
                <option key={roomType.id} value={roomType.id}>
                  {roomType.name}
                </option>
              ))}
            </Select>
            <Select
              size="sm"
              width="150px"
              aria-label="Ocupación"
              value={filters.occupancy}
              onChange={(event) => setFilters({ ...filters, occupancy: event.target.value })}
            >
              <option value="">Ocupación</option>
              <option value="VACANT">Libre</option>
              <option value="OCCUPIED">Ocupada</option>
            </Select>
            <Select
              size="sm"
              width="140px"
              aria-label="Piso"
              value={filters.floor}
              onChange={(event) => setFilters({ ...filters, floor: event.target.value })}
            >
              <option value="">Todos los pisos</option>
              {data?.facets.floors.map((floor) => (
                <option key={floor} value={floor}>
                  Piso {floor}
                </option>
              ))}
            </Select>
            <Select
              size="sm"
              width="160px"
              aria-label="Ala o edificio"
              value={filters.building}
              onChange={(event) => setFilters({ ...filters, building: event.target.value })}
            >
              <option value="">Todas las alas</option>
              {data?.facets.buildings.map((building) => (
                <option key={building} value={building}>
                  {building}
                </option>
              ))}
            </Select>
            <Select
              size="sm"
              width="160px"
              aria-label="Capacidad mínima"
              value={filters.minCapacity}
              onChange={(event) => setFilters({ ...filters, minCapacity: event.target.value })}
            >
              <option value="">Capacidad</option>
              {[1, 2, 3, 4, 5, 6].map((capacity) => (
                <option key={capacity} value={capacity}>
                  {capacity}+ personas
                </option>
              ))}
            </Select>
            <Select
              size="sm"
              width="170px"
              aria-label="Estado operativo"
              value={filters.operationalState}
              onChange={(event) => setFilters({ ...filters, operationalState: event.target.value })}
            >
              <option value="">Estado operativo</option>
              <option value="AVAILABLE">Disponible</option>
              <option value="OUT_OF_ORDER">Fuera de orden</option>
              <option value="OUT_OF_SERVICE">Fuera de servicio</option>
            </Select>
            <Select
              size="sm"
              width="170px"
              aria-label="Housekeeping"
              value={filters.housekeepingState}
              onChange={(event) =>
                setFilters({ ...filters, housekeepingState: event.target.value })
              }
            >
              <option value="">Housekeeping</option>
              <option value="DIRTY">Sucia</option>
              <option value="CLEANING">En limpieza</option>
              <option value="CLEAN">Limpia</option>
              <option value="INSPECTED">Inspeccionada</option>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearchInput('');
                setFilters({
                  search: '',
                  roomTypeId: '',
                  floor: '',
                  building: '',
                  minCapacity: '',
                  occupancy: '',
                  operationalState: '',
                  housekeepingState: '',
                });
              }}
            >
              Limpiar
            </Button>
          </HStack>
          <Text fontSize="xs" color="textSecondary">
            {data?.rooms.length ?? 0} habitaciones cargadas (máximo 100 por consulta).
          </Text>
        </Stack>

        <QueryFeedback
          loading={loading}
          error={error}
          onRetry={reload}
          isEmpty={(data?.rooms.length ?? 0) === 0}
          emptyText="No hay habitaciones que coincidan con los filtros."
        >
          <TableContainer overflowX="auto">
            <Table size="sm" minW="1065px" sx={{ tableLayout: 'fixed' }}>
              <Thead>
                <Tr>
                  <Th width="130px">UH</Th>
                  <Th width="155px">Tipo / capacidad</Th>
                  <Th width="95px">Piso / ala</Th>
                  <Th width="225px">Ocupación</Th>
                  <Th width="110px">Housekeeping</Th>
                  <Th width="125px">Operativo</Th>
                  <Th width="115px">Actualizada</Th>
                  <Th width="110px" position="sticky" right={0} bg="gray.50" zIndex={1}>
                    Acciones
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {data?.rooms.map((room) => (
                  <Tr key={room.id}>
                    <Td>
                      <Text fontWeight="semibold">{room.number}</Text>
                      {room.status !== 'ACTIVE' && (
                        <StatusBadge
                          color={RECORD_STATUS_COLORS[room.status] ?? 'gray'}
                          label={RECORD_STATUS_LABELS[room.status] ?? room.status}
                        />
                      )}
                      {room.attributes.length > 0 && (
                        <Text fontSize="xs" color="textSecondary" noOfLines={1} maxW="180px">
                          {room.attributes.join(' · ')}
                        </Text>
                      )}
                    </Td>
                    <Td>
                      <Text>{room.roomType.name}</Text>
                      <Text fontSize="xs" color="textSecondary">
                        {room.roomType.capacityAdults} adulto(s)
                        {room.roomType.capacityChildren > 0
                          ? ` + ${room.roomType.capacityChildren} menor(es)`
                          : ''}
                      </Text>
                    </Td>
                    <Td>
                      {[room.floor, room.building].filter((value) => value !== null).join(' / ') ||
                        '—'}
                    </Td>
                    <Td>
                      <StatusBadge
                        color={OCCUPANCY_COLORS[room.occupancy]}
                        label={OCCUPANCY_LABELS[room.occupancy]}
                      />
                      {room.currentStay !== null && (
                        <Box mt={1}>
                          <Text fontSize="xs" fontWeight="medium" noOfLines={1}>
                            {room.currentStay.guestName}
                          </Text>
                          <Text fontSize="xs" color="textSecondary" noOfLines={1}>
                            {room.currentStay.code} · hasta{' '}
                            {formatCalendarDate(room.currentStay.checkOutDate)}
                          </Text>
                        </Box>
                      )}
                      {room.currentStay === null && room.nextArrival !== null && (
                        <Text fontSize="xs" color="textSecondary" mt={1} noOfLines={1}>
                          Próx. {room.nextArrival.code} ·{' '}
                          {formatCalendarDate(room.nextArrival.checkInDate)}
                        </Text>
                      )}
                      {room.lease !== null && (
                        <Text fontSize="xs" color="warning.600" mt={1}>
                          En selección: {room.lease.ownerDisplayName}
                        </Text>
                      )}
                    </Td>
                    <Td>
                      <StatusBadge
                        color={HOUSEKEEPING_COLORS[room.housekeepingState]}
                        label={HOUSEKEEPING_LABELS[room.housekeepingState]}
                      />
                    </Td>
                    <Td>
                      <StatusBadge
                        color={OPERATIONAL_COLORS[room.operationalState]}
                        label={OPERATIONAL_LABELS[room.operationalState]}
                      />
                      {room.activeBlock !== null && (
                        <Text fontSize="xs" color="textSecondary" mt={1}>
                          Bloqueo hasta {formatDateTime(room.activeBlock.endsAt)}
                        </Text>
                      )}
                    </Td>
                    <Td>
                      <Text fontSize="xs">{formatDateTime(room.updatedAt)}</Text>
                      <Text fontSize="xs" color="textSecondary" noOfLines={1}>
                        {room.updatedBy?.name ?? 'Sistema'}
                      </Text>
                    </Td>
                    <Td
                      position="sticky"
                      right={0}
                      bg="white"
                      zIndex={1}
                      borderLeftWidth="1px"
                      borderLeftColor="gray.100"
                    >
                      <HStack spacing={1} justify="flex-end" wrap="nowrap">
                        <RowActionButton onClick={() => openDetail(room)}>Detalle</RowActionButton>
                        <RowActionButton onClick={() => openEdit(room)}>Editar</RowActionButton>
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </QueryFeedback>
      </SectionCard>

      <Modal isOpen={createModal.isOpen} onClose={createModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleCreate(event)}>
          <ModalHeader>Nueva habitación</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Field
                label="Número"
                isRequired
                helper="Único por propiedad"
                error={createErrors.number}
              >
                <Input
                  value={createForm.number}
                  onChange={(event) => setCreateForm({ ...createForm, number: event.target.value })}
                  required
                  maxLength={32}
                />
              </Field>
              <Field label="Tipo" isRequired error={createErrors.roomTypeId}>
                <Select
                  value={createForm.roomTypeId}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, roomTypeId: event.target.value })
                  }
                  required
                >
                  <option value="">Seleccionar…</option>
                  {data?.roomTypes.map((roomType) => (
                    <option key={roomType.id} value={roomType.id}>
                      {roomType.name} ({roomType.capacityAdults} adultos)
                    </option>
                  ))}
                </Select>
              </Field>
              <HStack spacing={4} align="flex-start">
                <Field label="Piso" error={createErrors.floor}>
                  <Input
                    value={createForm.floor}
                    maxLength={32}
                    onChange={(event) =>
                      setCreateForm({ ...createForm, floor: event.target.value })
                    }
                  />
                </Field>
                <Field label="Edificio" error={createErrors.building}>
                  <Input
                    value={createForm.building}
                    maxLength={64}
                    onChange={(event) =>
                      setCreateForm({ ...createForm, building: event.target.value })
                    }
                  />
                </Field>
              </HStack>
              <Field
                label="Atributos"
                error={createErrors.attributes}
                helper="Separados por coma: balcón, accesible, silenciosa…"
              >
                <Input
                  value={createForm.attributes}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, attributes: event.target.value })
                  }
                />
              </Field>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={createModal.onClose}>
              Cancelar
            </Button>
            <Button type="submit" colorScheme="brand" isLoading={saving}>
              Crear
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={editModal.isOpen} onClose={editModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleEdit(event)}>
          <ModalHeader>Editar habitación</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Field label="Número" isRequired error={editErrors.number}>
                <Input
                  value={editForm.number}
                  onChange={(event) => setEditForm({ ...editForm, number: event.target.value })}
                  required
                  maxLength={32}
                />
              </Field>
              <Field label="Tipo" isRequired error={editErrors.roomTypeId}>
                <Select
                  value={editForm.roomTypeId}
                  onChange={(event) => setEditForm({ ...editForm, roomTypeId: event.target.value })}
                  required
                >
                  {data?.roomTypes.map((roomType) => (
                    <option key={roomType.id} value={roomType.id}>
                      {roomType.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <HStack spacing={4} align="flex-start">
                <Field label="Piso" error={editErrors.floor}>
                  <Input
                    value={editForm.floor}
                    maxLength={32}
                    onChange={(event) => setEditForm({ ...editForm, floor: event.target.value })}
                  />
                </Field>
                <Field label="Edificio" error={editErrors.building}>
                  <Input
                    value={editForm.building}
                    maxLength={64}
                    onChange={(event) => setEditForm({ ...editForm, building: event.target.value })}
                  />
                </Field>
              </HStack>
              <Field label="Atributos" error={editErrors.attributes} helper="Separados por coma">
                <Input
                  value={editForm.attributes}
                  onChange={(event) => setEditForm({ ...editForm, attributes: event.target.value })}
                />
              </Field>
              <Field label="Estado">
                <Select
                  value={editForm.status}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      status: event.target.value as 'ACTIVE' | 'DISABLED',
                    })
                  }
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="DISABLED">Deshabilitado</option>
                </Select>
              </Field>
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

      <Drawer isOpen={drawer.isOpen} placement="right" onClose={drawer.onClose} size="lg">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>
            Habitación {selectedRoom?.number}
            {selectedRoom !== null && (
              <Text fontSize="sm" fontWeight="normal" color="textSecondary">
                {selectedRoom.roomType.name} ·{' '}
                {selectedRoom.attributes.join(' · ') || 'sin atributos'}
              </Text>
            )}
          </DrawerHeader>
          <DrawerBody pb={10}>
            {selectedRoom !== null && (
              <Stack spacing={6}>
                <SimpleGrid columns={2} spacing={3}>
                  <KeyValue
                    label="Housekeeping"
                    value={HOUSEKEEPING_LABELS[selectedRoom.housekeepingState]}
                  />
                  <KeyValue
                    label="Operativo"
                    value={OPERATIONAL_LABELS[selectedRoom.operationalState]}
                  />
                  <KeyValue label="Ocupación" value={OCCUPANCY_LABELS[selectedRoom.occupancy]} />
                  <KeyValue
                    label="Capacidad"
                    value={`${selectedRoom.roomType.capacityAdults} adulto(s)${
                      selectedRoom.roomType.capacityChildren > 0
                        ? ` + ${selectedRoom.roomType.capacityChildren} menor(es)`
                        : ''
                    }`}
                  />
                  <KeyValue label="Piso" value={selectedRoom.floor ?? '—'} />
                  <KeyValue label="Ala / edificio" value={selectedRoom.building ?? '—'} />
                  <KeyValue
                    label="Última modificación"
                    value={formatDateTime(selectedRoom.updatedAt)}
                  />
                  <KeyValue
                    label="Modificado por"
                    value={selectedRoom.updatedBy?.name ?? 'Sistema'}
                  />
                </SimpleGrid>

                <Box>
                  <Text fontWeight="semibold" mb={2}>
                    Estancia y reserva
                  </Text>
                  {selectedRoom.currentStay !== null ? (
                    <Stack spacing={1}>
                      <HStack justify="space-between">
                        <Text fontSize="sm" fontWeight="medium">
                          {selectedRoom.currentStay.guestName}
                        </Text>
                        <Badge colorScheme="brand">{selectedRoom.currentStay.code}</Badge>
                      </HStack>
                      <Text fontSize="sm">
                        {formatCalendarDate(selectedRoom.currentStay.checkInDate)} →{' '}
                        {formatCalendarDate(selectedRoom.currentStay.checkOutDate)}
                      </Text>
                    </Stack>
                  ) : (
                    <Text fontSize="sm" color="textSecondary">
                      Sin estancia en casa.
                    </Text>
                  )}
                  {selectedRoom.nextArrival !== null && (
                    <Text fontSize="sm" color="textPrimary" mt={2}>
                      Próxima llegada: {selectedRoom.nextArrival.guestName} ·{' '}
                      {selectedRoom.nextArrival.code} ·{' '}
                      {formatCalendarDate(selectedRoom.nextArrival.checkInDate)}
                    </Text>
                  )}
                  {selectedRoom.activeBlock !== null && (
                    <Text fontSize="sm" color="warning.600" mt={2}>
                      Bloqueo activo ({BLOCK_TYPE_LABELS[selectedRoom.activeBlock.type]}) hasta{' '}
                      {formatDateTime(selectedRoom.activeBlock.endsAt)}
                    </Text>
                  )}
                </Box>

                <Box>
                  <Text fontWeight="semibold" mb={2}>
                    Selección temporal
                  </Text>
                  {selectedRoom.lease !== null ? (
                    <Stack spacing={2}>
                      <Text fontSize="sm">
                        En selección por <strong>{selectedRoom.lease.ownerDisplayName}</strong>{' '}
                        hasta {formatDateTime(selectedRoom.lease.expiresAt)}.
                      </Text>
                      {selectedRoom.lease.ownerUserId === actor?.id ? (
                        <HStack>
                          <Button
                            size="sm"
                            variant="outline"
                            isLoading={leaseBusy}
                            onClick={() => void renewLease()}
                          >
                            Renovar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            isLoading={leaseBusy}
                            onClick={() => void releaseLease()}
                          >
                            Liberar
                          </Button>
                        </HStack>
                      ) : (
                        <Stack spacing={2}>
                          {forceOpen ? (
                            <>
                              <Input
                                size="sm"
                                placeholder="Motivo de la liberación"
                                value={forceReason}
                                onChange={(event) => setForceReason(event.target.value)}
                              />
                              <HStack>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  isLoading={leaseBusy}
                                  isDisabled={forceReason.trim() === ''}
                                  onClick={() => void forceReleaseLease()}
                                >
                                  Confirmar liberación
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  isDisabled={leaseBusy}
                                  onClick={() => {
                                    setForceOpen(false);
                                    setForceReason('');
                                  }}
                                >
                                  Cancelar
                                </Button>
                              </HStack>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              alignSelf="flex-start"
                              variant="ghost"
                              isLoading={leaseBusy}
                              onClick={() => setForceOpen(true)}
                            >
                              Liberar selección forzada
                            </Button>
                          )}
                        </Stack>
                      )}
                    </Stack>
                  ) : (
                    <Stack spacing={2}>
                      <Text fontSize="sm" color="textSecondary">
                        Nadie está seleccionando esta habitación. La selección expira sola y no
                        reserva la habitación.
                      </Text>
                      <Button
                        size="sm"
                        alignSelf="flex-start"
                        variant="outline"
                        isLoading={leaseBusy}
                        onClick={() => void acquireLease()}
                      >
                        Tomar selección
                      </Button>
                    </Stack>
                  )}
                </Box>

                <Box
                  as="form"
                  onSubmit={(event) => void createIncident(event)}
                  borderWidth="1px"
                  borderRadius="md"
                  p={3}
                >
                  <Text fontWeight="semibold" mb={2}>
                    Registrar incidencia
                  </Text>
                  <Stack spacing={2}>
                    <HStack>
                      <Select
                        size="sm"
                        aria-label="Tipo de incidencia"
                        value={incidentForm.type}
                        onChange={(event) =>
                          setIncidentForm({
                            ...incidentForm,
                            type: event.target.value as IncidentType,
                          })
                        }
                      >
                        {Object.entries(INCIDENT_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                      <Select
                        size="sm"
                        aria-label="Severidad de la incidencia"
                        value={incidentForm.severity}
                        onChange={(event) =>
                          setIncidentForm({
                            ...incidentForm,
                            severity: event.target.value as IncidentSeverity,
                          })
                        }
                      >
                        {Object.entries(INCIDENT_SEVERITY_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </HStack>
                    <Input
                      size="sm"
                      placeholder="Título (3–120)"
                      maxLength={120}
                      value={incidentForm.title}
                      onChange={(event) =>
                        setIncidentForm({ ...incidentForm, title: event.target.value })
                      }
                      required
                    />
                    <Textarea
                      rows={3}
                      placeholder="Descripción (3–4000), sin datos sensibles"
                      maxLength={4000}
                      value={incidentForm.description}
                      onChange={(event) =>
                        setIncidentForm({ ...incidentForm, description: event.target.value })
                      }
                      required
                    />
                    <Button
                      type="submit"
                      size="sm"
                      alignSelf="flex-start"
                      colorScheme="brand"
                      isLoading={incidentSaving}
                    >
                      Registrar
                    </Button>
                  </Stack>
                </Box>

                <Box>
                  <Text fontWeight="semibold" mb={2}>
                    Transición de housekeeping
                  </Text>
                  <HStack mb={2}>
                    <Input
                      size="sm"
                      placeholder="Motivo (opcional)"
                      value={transitionReason}
                      onChange={(event) => setTransitionReason(event.target.value)}
                    />
                  </HStack>
                  <HStack wrap="wrap">
                    {nextHousekeeping.length === 0 && (
                      <Text fontSize="sm" color="textSecondary">
                        Sin transiciones disponibles.
                      </Text>
                    )}
                    {nextHousekeeping.map((state) => (
                      <Button
                        key={state}
                        size="sm"
                        variant="outline"
                        isLoading={transitioning}
                        onClick={() => void transitionHousekeeping(state)}
                      >
                        → {HOUSEKEEPING_LABELS[state]}
                      </Button>
                    ))}
                  </HStack>
                </Box>

                <Divider />

                <Box>
                  <Text fontWeight="semibold" mb={2}>
                    Bloqueos
                  </Text>
                  <QueryFeedback
                    loading={detail.loading}
                    error={detail.error}
                    onRetry={detail.reload}
                    isEmpty={(detail.data?.blocks.length ?? 0) === 0}
                    emptyText="Sin bloqueos registrados."
                  >
                    <Stack spacing={2} mb={4}>
                      {detail.data?.blocks.map((block) => (
                        <HStack
                          key={block.id}
                          justify="space-between"
                          borderWidth="1px"
                          borderRadius="md"
                          px={3}
                          py={2}
                          align="flex-start"
                        >
                          <Box>
                            <HStack spacing={2}>
                              <Badge
                                colorScheme={block.type === 'OUT_OF_ORDER' ? 'danger' : 'warning'}
                              >
                                {BLOCK_TYPE_LABELS[block.type]}
                              </Badge>
                              <Badge colorScheme={block.status === 'ACTIVE' ? 'mint' : 'gray'}>
                                {BLOCK_STATUS_LABELS[block.status]}
                              </Badge>
                            </HStack>
                            <Text fontSize="sm" mt={1}>
                              {block.reason}
                            </Text>
                            <Text fontSize="xs" color="textSecondary">
                              {formatDateTime(block.startsAt)} → {formatDateTime(block.endsAt)}
                            </Text>
                          </Box>
                          {block.status === 'ACTIVE' && (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => void releaseBlock(block)}
                            >
                              Liberar
                            </Button>
                          )}
                        </HStack>
                      ))}
                    </Stack>
                  </QueryFeedback>

                  <Box
                    as="form"
                    onSubmit={(event) => void createBlock(event)}
                    borderTopWidth="1px"
                    pt={3}
                  >
                    <Text fontSize="sm" fontWeight="medium" mb={2}>
                      Nuevo bloqueo
                    </Text>
                    <Stack spacing={3}>
                      <Select
                        size="sm"
                        value={blockForm.type}
                        onChange={(event) =>
                          setBlockForm({ ...blockForm, type: event.target.value })
                        }
                      >
                        <option value="OUT_OF_ORDER">Fuera de orden</option>
                        <option value="OUT_OF_SERVICE">Fuera de servicio</option>
                      </Select>
                      <Input
                        size="sm"
                        placeholder="Motivo (3–500)"
                        value={blockForm.reason}
                        onChange={(event) =>
                          setBlockForm({ ...blockForm, reason: event.target.value })
                        }
                        isInvalid={blockErrors.reason !== undefined}
                        maxLength={500}
                      />
                      {blockErrors.reason !== undefined && (
                        <Text fontSize="xs" color="danger.500">
                          {blockErrors.reason}
                        </Text>
                      )}
                      <HStack>
                        <Box flex="1">
                          <Text fontSize="xs" color="textSecondary" mb={1}>
                            Inicio
                          </Text>
                          <Input
                            size="sm"
                            type="datetime-local"
                            value={blockForm.startsAt}
                            onChange={(event) =>
                              setBlockForm({ ...blockForm, startsAt: event.target.value })
                            }
                            required
                          />
                        </Box>
                        <Box flex="1">
                          <Text fontSize="xs" color="textSecondary" mb={1}>
                            Fin
                          </Text>
                          <Input
                            size="sm"
                            type="datetime-local"
                            value={blockForm.endsAt}
                            onChange={(event) =>
                              setBlockForm({ ...blockForm, endsAt: event.target.value })
                            }
                            required
                          />
                        </Box>
                      </HStack>
                      {(blockErrors.startsAt !== undefined || blockErrors.endsAt !== undefined) && (
                        <Text fontSize="xs" color="danger.500">
                          {blockErrors.startsAt ?? blockErrors.endsAt}
                        </Text>
                      )}
                      <Button type="submit" size="sm" colorScheme="brand" isLoading={blockSaving}>
                        Crear bloqueo
                      </Button>
                    </Stack>
                  </Box>
                </Box>

                <Divider />

                <Box>
                  <Text fontWeight="semibold" mb={2}>
                    Historial
                  </Text>
                  <QueryFeedback
                    loading={detail.loading}
                    error={detail.error}
                    onRetry={detail.reload}
                    isEmpty={(detail.data?.history.length ?? 0) === 0}
                    emptyText="Sin historial."
                  >
                    <Stack spacing={2} maxH="320px" overflowY="auto">
                      {detail.data?.history.map((entry) => (
                        <Box key={entry.id} borderLeftWidth="3px" borderColor="brand.200" pl={3}>
                          <Text fontSize="xs" color="textSecondary">
                            {formatDateTime(entry.occurredAt)} · {entry.category}
                            {entry.actorName !== null ? ` · ${entry.actorName}` : ''}
                          </Text>
                          <Text fontSize="sm">
                            {entry.fromState ?? '—'} → <strong>{entry.toState}</strong>
                          </Text>
                          {entry.reason !== null && (
                            <Text fontSize="xs" color="textSecondary">
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
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}

export default function RoomsPage() {
  return (
    <PropertyGate>
      <RoomsContent />
    </PropertyGate>
  );
}
