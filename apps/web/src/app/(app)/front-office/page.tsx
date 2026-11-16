'use client';

import {
  Badge,
  Box,
  Button,
  Divider,
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
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
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
import NextLink from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckInWizard } from '@/components/check-in-wizard';
import { PropertyGate } from '@/components/app-shell';
import { DateField } from '@/components/date-field';
import { ReservationDocuments } from '@/components/documents-panel';
import {
  Field,
  MetricCard,
  PageHeader,
  QueryFeedback,
  SectionCard,
  StatusBadge,
} from '@/components/ui';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import {
  HOUSEKEEPING_COLORS,
  HOUSEKEEPING_LABELS,
  INCIDENT_SEVERITY_COLORS,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_TYPE_LABELS,
  OPERATIONAL_COLORS,
  OPERATIONAL_LABELS,
  RESERVATION_STATUS_COLORS,
  RESERVATION_STATUS_LABELS,
  formatCalendarDate,
  formatDateTime,
  formatLongDate,
  todayISO,
} from '@/lib/format';
import type {
  FrontOfficeOverview,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  Reservation,
  ReservationStatus,
  RoomRackItem,
  Stay,
} from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

interface IncidentList {
  items: Incident[];
}

type IncidentScope = 'none' | 'stay' | 'room';

const TAB_INDEX: Record<string, number> = {
  arrivals: 0,
  'in-house': 1,
  departures: 2,
  rack: 3,
  incidents: 4,
};

interface SearchFilters {
  q: string;
  roomNumber: string;
  fromDate: string;
  toDate: string;
  status: ReservationStatus | '';
}

const EMPTY_SEARCH_FILTERS: SearchFilters = {
  q: '',
  roomNumber: '',
  fromDate: '',
  toDate: '',
  status: '',
};

function StayCard({
  stay,
  busy,
  readOnly = false,
  onCheckOut,
  onMove,
  onIncident,
}: {
  stay: Stay;
  busy: string | null;
  readOnly?: boolean;
  onCheckOut: (stay: Stay) => void;
  onMove: (stay: Stay) => void;
  onIncident: (stay: Stay) => void;
}) {
  return (
    <Box borderWidth="1px" borderRadius="md" px={3} py={2}>
      <HStack justify="space-between" align="flex-start" wrap="wrap">
        <Box>
          <Text fontSize="sm" fontWeight="semibold">
            Hab. {stay.room.number} · {stay.guest.fullName}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {stay.reservation.code} · salida {formatCalendarDate(stay.reservation.checkOutDate)}
            {stay.moveCount > 0 ? ` · ${stay.moveCount} cambio(s)` : ''}
            {stay.checkedOutAt !== null
              ? ` · salida registrada ${formatDateTime(stay.checkedOutAt)}`
              : ''}
          </Text>
        </Box>
        <StatusBadge
          color={stay.status === 'CHECKED_OUT' ? 'sky' : 'mint'}
          label={stay.status === 'CHECKED_OUT' ? 'Salió' : 'En casa'}
        />
      </HStack>
      <HStack spacing={1} mt={2} wrap="wrap">
        {!readOnly && (
          <>
            <Button
              size="xs"
              colorScheme="brand"
              onClick={() => onCheckOut(stay)}
              isLoading={busy === `check-out:${stay.id}`}
            >
              Check-out
            </Button>
            <Button size="xs" variant="outline" onClick={() => onMove(stay)}>
              Mover
            </Button>
            <Button size="xs" variant="ghost" onClick={() => onIncident(stay)}>
              Incidencia
            </Button>
          </>
        )}
        <ReservationDocuments
          reservationId={stay.reservation.id}
          reservationCode={stay.reservation.code}
        />
        <Button as={NextLink} href="/reservations" size="xs" variant="ghost">
          Reserva
        </Button>
      </HStack>
    </Box>
  );
}

function FrontOfficeContent() {
  const { tenant, property } = useSession();
  const propertyTimezone = property?.timezone;
  const toast = useToast();

  const [incidentFilter, setIncidentFilter] = useState<IncidentStatus | ''>('OPEN');
  const [busy, setBusy] = useState<string | null>(null);
  const [tabIndex, setTabIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState('');
  const [searchInputs, setSearchInputs] = useState<SearchFilters>(EMPTY_SEARCH_FILTERS);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(EMPTY_SEARCH_FILTERS);
  const [searchResults, setSearchResults] = useState<Reservation[]>([]);
  const [searchNextCursor, setSearchNextCursor] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<unknown>(null);
  const [searchActive, setSearchActive] = useState(false);

  const overview = useAsyncData<FrontOfficeOverview>(
    () =>
      api<FrontOfficeOverview>(
        `/api/v1/front-office/overview${
          selectedDate !== '' ? `?date=${encodeURIComponent(selectedDate)}` : ''
        }`,
        { tenant },
      ),
    `${tenant.organizationId}:${tenant.propertyId}:front-office:overview:${selectedDate}`,
  );

  useEffect(() => {
    if (overview.data?.isHistorical === true && tabIndex > 2) {
      setTabIndex(0);
    }
  }, [overview.data?.isHistorical, tabIndex]);

  const incidents = useAsyncData<IncidentList>(
    () =>
      api<IncidentList>(
        `/api/v1/front-office/incidents?limit=100${
          incidentFilter !== '' ? `&status=${incidentFilter}` : ''
        }`,
        { tenant },
      ),
    `${tenant.organizationId}:${tenant.propertyId}:front-office:incidents:${incidentFilter}`,
  );

  const checkoutModal = useDisclosure();
  const checkInModal = useDisclosure();
  const moveModal = useDisclosure();
  const noShowModal = useDisclosure();
  const incidentModal = useDisclosure();
  const resolveModal = useDisclosure();

  const [checkoutTarget, setCheckoutTarget] = useState<Stay | null>(null);
  const [checkoutNotes, setCheckoutNotes] = useState('');

  const [checkInTarget, setCheckInTarget] = useState<Reservation | null>(null);

  const [moveTarget, setMoveTarget] = useState<Stay | null>(null);
  const [moveRoomId, setMoveRoomId] = useState('');
  const [moveReason, setMoveReason] = useState('');

  const [noShowTarget, setNoShowTarget] = useState<Reservation | null>(null);
  const [noShowReason, setNoShowReason] = useState('');

  const [incidentTarget, setIncidentTarget] = useState<Stay | null>(null);
  const [incidentForm, setIncidentForm] = useState<{
    type: IncidentType;
    severity: IncidentSeverity;
    title: string;
    description: string;
    scope: IncidentScope;
    stayId: string;
    roomId: string;
  }>({
    type: 'NOTE',
    severity: 'MEDIUM',
    title: '',
    description: '',
    scope: 'none',
    stayId: '',
    roomId: '',
  });

  const [resolveTarget, setResolveTarget] = useState<Incident | null>(null);
  const [resolution, setResolution] = useState('');

  function reloadAll(): void {
    overview.reload();
    incidents.reload();
  }

  function changeDate(next: string): void {
    setSelectedDate(next);
    setTabIndex(0);
  }

  async function run(
    key: string,
    action: () => Promise<unknown>,
    successMessage: string,
    after?: () => void,
  ): Promise<void> {
    setBusy(key);
    try {
      await action();
      toast({ title: successMessage, status: 'success' });
      after?.();
      reloadAll();
    } catch (cause) {
      toast({
        title: 'No se pudo completar la operación',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setBusy(null);
    }
  }

  function openGuidedCheckIn(reservation: Reservation): void {
    setCheckInTarget(reservation);
    checkInModal.onOpen();
  }

  async function performSearch(filters: SearchFilters, cursor?: string): Promise<void> {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams({ limit: '25' });
      if (filters.q.trim() !== '') params.set('search', filters.q.trim());
      if (filters.roomNumber.trim() !== '') params.set('roomNumber', filters.roomNumber.trim());
      if (filters.fromDate !== '') params.set('fromDate', filters.fromDate);
      if (filters.toDate !== '') params.set('toDate', filters.toDate);
      if (filters.status !== '') params.set('status', filters.status);
      if (cursor !== undefined) params.set('cursor', cursor);
      const body = await api<{ items: Reservation[]; nextCursor: string | null }>(
        `/api/v1/reservations?${params.toString()}`,
        { tenant },
      );
      setSearchResults((current) =>
        cursor === undefined ? body.items : [...current, ...body.items],
      );
      setSearchNextCursor(body.nextCursor);
    } catch (cause) {
      setSearchError(cause);
    } finally {
      setSearchLoading(false);
    }
  }

  function syncSearchQuery(filters: SearchFilters): void {
    const params = new URLSearchParams(window.location.search);
    const mapping: Array<[keyof SearchFilters, string]> = [
      ['q', 'q'],
      ['roomNumber', 'roomNumber'],
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

  function applySearch(event?: FormEvent): void {
    event?.preventDefault();
    const next = { ...searchInputs };
    setSearchFilters(next);
    setSearchActive(true);
    setSearchResults([]);
    setSearchNextCursor(null);
    syncSearchQuery(next);
    void performSearch(next);
  }

  function clearSearch(): void {
    setSearchInputs(EMPTY_SEARCH_FILTERS);
    setSearchFilters(EMPTY_SEARCH_FILTERS);
    setSearchActive(false);
    setSearchResults([]);
    setSearchNextCursor(null);
    setSearchError(null);
    syncSearchQuery(EMPTY_SEARCH_FILTERS);
  }

  function updateSearchInput<K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K],
  ): void {
    setSearchInputs((current) => ({ ...current, [key]: value }));
  }

  const searchBootstrapped = useRef(false);
  const performSearchRef = useRef(performSearch);
  performSearchRef.current = performSearch;
  useEffect(() => {
    if (searchBootstrapped.current) {
      return;
    }
    searchBootstrapped.current = true;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab !== null && TAB_INDEX[tab] !== undefined) {
      setTabIndex(TAB_INDEX[tab]);
    }
    const status = params.get('status');
    const initial: SearchFilters = {
      q: params.get('q') ?? '',
      roomNumber: params.get('roomNumber') ?? '',
      fromDate: params.get('fromDate') ?? '',
      toDate: params.get('toDate') ?? '',
      status:
        status !== null && Object.prototype.hasOwnProperty.call(RESERVATION_STATUS_LABELS, status)
          ? (status as ReservationStatus)
          : '',
    };
    const active = Object.values(initial).some((value) => value !== '');
    if (active) {
      setSearchInputs(initial);
      setSearchFilters(initial);
      setSearchActive(true);
      void performSearchRef.current(initial);
    }
  }, []);

  function openCheckOut(stay: Stay): void {
    setCheckoutTarget(stay);
    setCheckoutNotes('');
    checkoutModal.onOpen();
  }

  async function handleCheckOut(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (checkoutTarget === null) {
      return;
    }
    const target = checkoutTarget;
    await run(
      `check-out:${target.id}`,
      () =>
        api(`/api/v1/front-office/stays/${target.id}/check-out`, {
          method: 'POST',
          tenant,
          body: checkoutNotes.trim() === '' ? {} : { notes: checkoutNotes.trim() },
        }),
      `Check-out registrado para ${target.guest.fullName}`,
      checkoutModal.onClose,
    );
  }

  function openMove(stay: Stay): void {
    setMoveTarget(stay);
    setMoveRoomId('');
    setMoveReason('');
    moveModal.onOpen();
  }

  async function handleMove(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (moveTarget === null || moveRoomId === '') {
      return;
    }
    const target = moveTarget;
    await run(
      `move:${target.id}`,
      () =>
        api(`/api/v1/front-office/stays/${target.id}/room-move`, {
          method: 'POST',
          tenant,
          body: {
            roomId: moveRoomId,
            ...(moveReason.trim().length >= 3 ? { reason: moveReason.trim() } : {}),
          },
        }),
      'Habitación actualizada',
      moveModal.onClose,
    );
  }

  function openNoShow(reservation: Reservation): void {
    setNoShowTarget(reservation);
    setNoShowReason('');
    noShowModal.onOpen();
  }

  async function handleNoShow(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (noShowTarget === null) {
      return;
    }
    const target = noShowTarget;
    await run(
      `no-show:${target.id}`,
      () =>
        api(`/api/v1/front-office/reservations/${target.id}/no-show`, {
          method: 'POST',
          tenant,
          body: {
            ...(noShowReason.trim().length >= 3 ? { reason: noShowReason.trim() } : {}),
          },
        }),
      'Reserva marcada como no-show',
      noShowModal.onClose,
    );
  }

  function openIncident(stay?: Stay, room?: RoomRackItem): void {
    setIncidentTarget(stay ?? null);
    setIncidentForm({
      type: 'NOTE',
      severity: 'MEDIUM',
      title: '',
      description: '',
      scope: stay !== undefined ? 'stay' : room !== undefined ? 'room' : 'none',
      stayId: stay?.id ?? '',
      roomId: room?.id ?? '',
    });
    incidentModal.onOpen();
  }

  async function handleCreateIncident(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (incidentForm.title.trim().length < 3 || incidentForm.description.trim().length < 3) {
      toast({ title: 'Completá título y descripción', status: 'warning' });
      return;
    }
    await run(
      'incident:create',
      () =>
        api('/api/v1/front-office/incidents', {
          method: 'POST',
          tenant,
          body: {
            type: incidentForm.type,
            severity: incidentForm.severity,
            title: incidentForm.title.trim(),
            description: incidentForm.description.trim(),
            ...(incidentForm.scope === 'stay' && incidentForm.stayId !== ''
              ? { stayId: incidentForm.stayId }
              : {}),
            ...(incidentForm.scope === 'room' && incidentForm.roomId !== ''
              ? { roomId: incidentForm.roomId }
              : {}),
          },
        }),
      'Incidencia registrada',
      incidentModal.onClose,
    );
  }

  function openResolve(incident: Incident): void {
    setResolveTarget(incident);
    setResolution('');
    resolveModal.onOpen();
  }

  async function handleResolve(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (resolveTarget === null || resolution.trim().length < 3) {
      toast({ title: 'Escribí una resolución de al menos 3 caracteres', status: 'warning' });
      return;
    }
    const target = resolveTarget;
    await run(
      `incident:resolve:${target.id}`,
      () =>
        api(`/api/v1/front-office/incidents/${target.id}/resolve`, {
          method: 'POST',
          tenant,
          body: { resolution: resolution.trim() },
        }),
      'Incidencia resuelta',
      resolveModal.onClose,
    );
  }

  const data = overview.data;
  const operationalDate = data?.operationalDate ?? '';
  const referenceDate =
    selectedDate !== '' ? selectedDate : (data?.selectedDate ?? todayISO(0, propertyTimezone));
  const isHistorical = data?.isHistorical ?? false;
  const inHouse = data?.inHouse ?? [];
  const moveCandidates =
    data?.roomRack.filter(
      (room) =>
        moveTarget !== null &&
        room.id !== moveTarget.room.id &&
        room.roomType.id === moveTarget.reservation.roomType.id &&
        room.occupancy === 'VACANT' &&
        room.operationalState === 'AVAILABLE' &&
        room.activeBlock === null,
    ) ?? [];

  return (
    <>
      <PageHeader
        title="Front Office"
        description={
          data !== null
            ? data.isHistorical
              ? `Vista histórica · ${formatLongDate(data.selectedDate)}. Solo lectura: llegadas, estancias y salidas corresponden a ese día; el room rack y las incidencias quedan ocultos porque reflejan el estado actual.`
              : `Día operativo ${formatCalendarDate(data.operationalDate)} · hora local ${data.localTime} · ${data.timezone} (inicio ${data.operationalDayStart}). La ocupación se deriva de estancias en casa, separada de housekeeping.`
            : 'Llegadas, estancias en casa, salidas, room rack e incidencias del día operativo.'
        }
        actions={
          <HStack spacing={2} wrap="wrap">
            <DateField
              value={referenceDate}
              onChange={changeDate}
              placeholder="Día a consultar"
              ariaLabel="Día operativo a consultar"
              max={data?.operationalDate}
              today={data?.operationalDate ?? todayISO(0, propertyTimezone)}
              width="168px"
            />
            <Button
              size="sm"
              variant={isHistorical ? 'solid' : 'outline'}
              colorScheme={isHistorical ? 'warning' : undefined}
              onClick={() => changeDate(data?.operationalDate ?? '')}
              isDisabled={!isHistorical}
            >
              Hoy
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={reloadAll}
              isLoading={overview.loading && data !== null}
            >
              Actualizar
            </Button>
          </HStack>
        }
      />

      <SectionCard mb={6}>
        <form onSubmit={applySearch}>
          <Stack spacing={3}>
            <HStack justify="space-between" wrap="wrap">
              <Box>
                <Text fontWeight="semibold">Búsqueda operativa</Text>
                <Text fontSize="xs" color="gray.500">
                  Huésped (sin importar acentos), código de reserva o UH. Combiná con fechas y
                  estado.
                </Text>
              </Box>
              {searchActive && (
                <Button size="xs" variant="ghost" onClick={clearSearch}>
                  Limpiar filtros
                </Button>
              )}
            </HStack>
            <SimpleGrid columns={{ base: 1, md: 2, xl: 5 }} spacing={3}>
              <Field label="Huésped, reserva o UH">
                <Input
                  value={searchInputs.q}
                  placeholder="Ej.: José, DEMO-1104, 201"
                  onChange={(event) => updateSearchInput('q', event.target.value)}
                />
              </Field>
              <Field label="UH" helper="Opcional">
                <Input
                  value={searchInputs.roomNumber}
                  placeholder="Ej.: 201"
                  onChange={(event) => updateSearchInput('roomNumber', event.target.value)}
                />
              </Field>
              <Field label="Desde">
                <DateField
                  value={searchInputs.fromDate}
                  onChange={(value) => updateSearchInput('fromDate', value)}
                  placeholder="Cualquier fecha"
                  ariaLabel="Desde"
                />
              </Field>
              <Field label="Hasta">
                <DateField
                  value={searchInputs.toDate}
                  onChange={(value) => updateSearchInput('toDate', value)}
                  placeholder="Cualquier fecha"
                  ariaLabel="Hasta"
                />
              </Field>
              <Field label="Estado">
                <Select
                  value={searchInputs.status}
                  onChange={(event) =>
                    updateSearchInput('status', event.target.value as ReservationStatus | '')
                  }
                >
                  <option value="">Todos</option>
                  {Object.entries(RESERVATION_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </SimpleGrid>
            <HStack justify="space-between" wrap="wrap">
              <Text fontSize="xs" color="gray.500">
                Las fechas filtran reservas que solapan el rango elegido.
              </Text>
              <Button type="submit" size="sm" colorScheme="brand" isLoading={searchLoading}>
                Buscar
              </Button>
            </HStack>
          </Stack>
        </form>

        {searchActive && (
          <Box mt={4}>
            <QueryFeedback
              loading={searchLoading && searchResults.length === 0}
              error={searchError}
              onRetry={() => void performSearch(searchFilters)}
              isEmpty={!searchLoading && searchResults.length === 0}
              emptyText="Ninguna reserva coincide con los filtros."
            >
              <TableContainer overflowX="auto">
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Huésped</Th>
                      <Th>Reserva</Th>
                      <Th>UH</Th>
                      <Th>Llegada</Th>
                      <Th>Salida</Th>
                      <Th>Estado</Th>
                      <Th>Tipo</Th>
                      <Th />
                    </Tr>
                  </Thead>
                  <Tbody>
                    {searchResults.map((reservation) => (
                      <Tr key={reservation.id}>
                        <Td>
                          <Text fontWeight="medium">{reservation.guest.fullName}</Text>
                        </Td>
                        <Td>{reservation.code}</Td>
                        <Td>{reservation.room?.number ?? 'Sin UH'}</Td>
                        <Td>{formatCalendarDate(reservation.checkInDate)}</Td>
                        <Td>{formatCalendarDate(reservation.checkOutDate)}</Td>
                        <Td>
                          <StatusBadge
                            color={RESERVATION_STATUS_COLORS[reservation.status] ?? 'gray'}
                            label={RESERVATION_STATUS_LABELS[reservation.status]}
                          />
                        </Td>
                        <Td>{reservation.roomType.name}</Td>
                        <Td>
                          <HStack spacing={1} justify="flex-end" wrap="wrap">
                            <Button
                              as={NextLink}
                              href={`/reservations?reservation=${reservation.id}`}
                              size="xs"
                              variant="ghost"
                            >
                              Abrir
                            </Button>
                            <Button
                              as={NextLink}
                              href={`/guests?search=${encodeURIComponent(reservation.guest.fullName)}`}
                              size="xs"
                              variant="ghost"
                            >
                              Huésped
                            </Button>
                            {reservation.status === 'CONFIRMED' && (
                              <Button
                                size="xs"
                                colorScheme="brand"
                                onClick={() => openGuidedCheckIn(reservation)}
                              >
                                Check-in
                              </Button>
                            )}
                          </HStack>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
              {searchNextCursor !== null && (
                <HStack justify="center" mt={3}>
                  <Button
                    size="sm"
                    variant="outline"
                    isLoading={searchLoading}
                    onClick={() => void performSearch(searchFilters, searchNextCursor)}
                  >
                    Cargar más
                  </Button>
                </HStack>
              )}
            </QueryFeedback>
          </Box>
        )}
      </SectionCard>

      <QueryFeedback
        loading={overview.loading && data === null}
        error={overview.error}
        onRetry={overview.reload}
        isEmpty={data === null}
        emptyText="No se pudo cargar el tablero operativo."
      >
        {data !== null && (
          <Stack spacing={5}>
            {data.isHistorical && (
              <HStack
                bg="warning.50"
                borderWidth="1px"
                borderColor="warning.200"
                borderRadius="lg"
                px={4}
                py={3}
                align="flex-start"
                spacing={3}
              >
                <Badge colorScheme="warning" textTransform="none" mt={0.5}>
                  Vista histórica
                </Badge>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" color="warning.800">
                    {formatLongDate(data.selectedDate)}
                  </Text>
                  <Text fontSize="xs" color="warning.700">
                    Consulta de solo lectura. Para operar sobre las llegadas o salidas pendientes,
                    volvé al día operativo actual.
                  </Text>
                </Box>
              </HStack>
            )}

            <SimpleGrid columns={{ base: 2, md: 3, xl: data.isHistorical ? 4 : 6 }} spacing={3}>
              <MetricCard label="Llegadas" value={data.counts.arrivals} accent="sky" />
              <MetricCard
                label={data.isHistorical ? 'Alojados' : 'En casa'}
                value={data.counts.inHouse}
                accent="mint"
              />
              <MetricCard label="Salidas" value={data.counts.departures} accent="warning" />
              {data.isHistorical ? (
                <MetricCard
                  label="No-show"
                  value={data.counts.noShowCandidates}
                  hint="marcados ese día"
                  accent="danger"
                />
              ) : (
                <>
                  <MetricCard label="Libres" value={data.counts.vacantRooms} accent="mint" />
                  <MetricCard label="Ocupadas" value={data.counts.occupiedRooms} accent="brand" />
                  <MetricCard
                    label="No-show por marcar"
                    value={data.counts.noShowCandidates}
                    hint="llegadas vencidas"
                    accent="danger"
                  />
                </>
              )}
            </SimpleGrid>

            <Tabs colorScheme="brand" index={tabIndex} onChange={setTabIndex} isLazy>
              <TabList>
                <Tab>Llegadas ({data.counts.arrivals})</Tab>
                <Tab>
                  {data.isHistorical ? 'Alojados' : 'En casa'} ({data.counts.inHouse})
                </Tab>
                <Tab>Salidas ({data.counts.departures})</Tab>
                {!data.isHistorical && <Tab>Room rack ({data.roomRack.length})</Tab>}
                {!data.isHistorical && <Tab>Incidencias</Tab>}
              </TabList>

              <TabPanels>
                <TabPanel px={0}>
                  <SectionCard>
                    <Text fontWeight="semibold" mb={1}>
                      {data.isHistorical
                        ? `Llegadas del ${formatCalendarDate(data.selectedDate)}`
                        : 'Llegadas del día operativo'}
                    </Text>
                    <Text fontSize="xs" color="gray.500" mb={3}>
                      {data.isHistorical
                        ? 'Reservas con llegada ese día, incluidos los estados finales. Vista de solo lectura.'
                        : `Reservas confirmadas con llegada hasta ${formatCalendarDate(operationalDate)}. El check-in se guía desde el flujo: valida habitación limpia, disponible y sin bloqueos.`}
                    </Text>
                    <QueryFeedback
                      loading={false}
                      error={null}
                      isEmpty={data.arrivals.length === 0}
                      emptyText={
                        data.isHistorical
                          ? 'No hubo llegadas registradas ese día.'
                          : 'No hay llegadas pendientes.'
                      }
                    >
                      <Stack spacing={2}>
                        {data.arrivals.map((reservation) => {
                          const late =
                            !data.isHistorical && reservation.checkInDate < operationalDate;
                          const missingRoom = reservation.room === null;
                          return (
                            <Box
                              key={reservation.id}
                              borderWidth="1px"
                              borderRadius="md"
                              px={3}
                              py={2}
                            >
                              <HStack justify="space-between" align="flex-start" wrap="wrap">
                                <Box>
                                  <HStack spacing={2} wrap="wrap">
                                    <Text fontSize="sm" fontWeight="semibold">
                                      {reservation.guest.fullName}
                                    </Text>
                                    <StatusBadge
                                      color={
                                        RESERVATION_STATUS_COLORS[reservation.status] ?? 'gray'
                                      }
                                      label={RESERVATION_STATUS_LABELS[reservation.status]}
                                    />
                                    {late && (
                                      <Badge colorScheme="warning" textTransform="none">
                                        Llegada vencida
                                      </Badge>
                                    )}
                                    {missingRoom && (
                                      <Badge colorScheme="danger" textTransform="none">
                                        Sin habitación
                                      </Badge>
                                    )}
                                  </HStack>
                                  <Text fontSize="xs" color="gray.500">
                                    {reservation.code} · {reservation.roomType.name} ·{' '}
                                    {formatCalendarDate(reservation.checkInDate)} →{' '}
                                    {formatCalendarDate(reservation.checkOutDate)} ·{' '}
                                    {reservation.nights}{' '}
                                    {reservation.nights === 1 ? 'noche' : 'noches'}
                                  </Text>
                                  <Text fontSize="xs" color="gray.500">
                                    Habitación:{' '}
                                    {reservation.room !== null
                                      ? reservation.room.number
                                      : 'sin asignar'}{' '}
                                    · {reservation.adults} adultos
                                    {reservation.children > 0
                                      ? ` · ${reservation.children} menores`
                                      : ''}
                                  </Text>
                                </Box>
                                <HStack spacing={1} wrap="wrap">
                                  <ReservationDocuments
                                    reservationId={reservation.id}
                                    reservationCode={reservation.code}
                                  />
                                  {!data.isHistorical && (
                                    <Button
                                      size="xs"
                                      colorScheme="brand"
                                      onClick={() => openGuidedCheckIn(reservation)}
                                      isLoading={busy === `check-in:${reservation.id}`}
                                    >
                                      Check-in
                                    </Button>
                                  )}
                                  {!data.isHistorical && late && (
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      colorScheme="warning"
                                      onClick={() => openNoShow(reservation)}
                                    >
                                      No-show
                                    </Button>
                                  )}
                                </HStack>
                              </HStack>
                            </Box>
                          );
                        })}
                      </Stack>
                    </QueryFeedback>
                  </SectionCard>
                </TabPanel>

                <TabPanel px={0}>
                  <SectionCard>
                    <Text fontWeight="semibold" mb={1}>
                      {data.isHistorical ? 'Huéspedes alojados ese día' : 'Huéspedes en casa'}
                    </Text>
                    <Text fontSize="xs" color="gray.500" mb={3}>
                      {data.isHistorical
                        ? 'Estancias activas en algún momento de ese día. La habitación mostrada es la última asignada.'
                        : 'Estancias con check-in realizado. El check-out es idempotente y libera la habitación.'}
                    </Text>
                    <QueryFeedback
                      loading={false}
                      error={null}
                      isEmpty={inHouse.length === 0}
                      emptyText={
                        data.isHistorical
                          ? 'No hubo huéspedes alojados ese día.'
                          : 'No hay huéspedes en casa.'
                      }
                    >
                      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={2}>
                        {inHouse.map((stay) => (
                          <StayCard
                            key={stay.id}
                            stay={stay}
                            busy={busy}
                            readOnly={data.isHistorical}
                            onCheckOut={openCheckOut}
                            onMove={openMove}
                            onIncident={(target) => openIncident(target)}
                          />
                        ))}
                      </SimpleGrid>
                    </QueryFeedback>
                  </SectionCard>
                </TabPanel>

                <TabPanel px={0}>
                  <SectionCard>
                    <Text fontWeight="semibold" mb={1}>
                      {data.isHistorical ? 'Salidas registradas' : 'Salidas pendientes'}
                    </Text>
                    <Text fontSize="xs" color="gray.500" mb={3}>
                      {data.isHistorical
                        ? 'Check-outs registrados durante ese día en la zona horaria de la propiedad.'
                        : 'Estancias en casa cuya fecha de check-out ya llegó.'}
                    </Text>
                    <QueryFeedback
                      loading={false}
                      error={null}
                      isEmpty={data.departures.length === 0}
                      emptyText={
                        data.isHistorical
                          ? 'No se registraron salidas ese día.'
                          : 'No hay salidas pendientes para el día operativo.'
                      }
                    >
                      <Stack spacing={2}>
                        {data.departures.map((stay) => (
                          <Box key={stay.id} borderWidth="1px" borderRadius="md" px={3} py={2}>
                            <HStack justify="space-between" align="flex-start" wrap="wrap">
                              <Box>
                                <Text fontSize="sm" fontWeight="semibold">
                                  Hab. {stay.room.number} · {stay.guest.fullName}
                                </Text>
                                <Text fontSize="xs" color="gray.500">
                                  {stay.reservation.code} · salida{' '}
                                  {formatCalendarDate(stay.reservation.checkOutDate)} · check-in{' '}
                                  {formatDateTime(stay.checkedInAt)}
                                  {stay.checkedOutAt !== null
                                    ? ` · salida registrada ${formatDateTime(stay.checkedOutAt)}`
                                    : ''}
                                </Text>
                              </Box>
                              {data.isHistorical ? (
                                <StatusBadge color="sky" label="Check-out" />
                              ) : (
                                <HStack spacing={1} wrap="wrap">
                                  <ReservationDocuments
                                    reservationId={stay.reservation.id}
                                    reservationCode={stay.reservation.code}
                                  />
                                  <Button
                                    size="xs"
                                    colorScheme="brand"
                                    onClick={() => openCheckOut(stay)}
                                    isLoading={busy === `check-out:${stay.id}`}
                                  >
                                    Check-out
                                  </Button>
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    onClick={() => openIncident(stay)}
                                  >
                                    Incidencia
                                  </Button>
                                </HStack>
                              )}
                            </HStack>
                          </Box>
                        ))}
                      </Stack>
                    </QueryFeedback>
                  </SectionCard>
                </TabPanel>

                <TabPanel px={0} hidden={data.isHistorical}>
                  <SectionCard>
                    <HStack justify="space-between" mb={3} wrap="wrap">
                      <Box>
                        <Text fontWeight="semibold">Room rack</Text>
                        <Text fontSize="xs" color="gray.500">
                          Ocupación y housekeeping son estados independientes.
                        </Text>
                      </Box>
                      <HStack spacing={3}>
                        <HStack spacing={1}>
                          <Box boxSize="10px" borderRadius="full" bg="mint.500" />
                          <Text fontSize="xs" color="gray.600">
                            Libre
                          </Text>
                        </HStack>
                        <HStack spacing={1}>
                          <Box boxSize="10px" borderRadius="full" bg="warning.500" />
                          <Text fontSize="xs" color="gray.600">
                            Ocupada
                          </Text>
                        </HStack>
                      </HStack>
                    </HStack>
                    <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing={3}>
                      {data.roomRack.map((room) => (
                        <Box
                          key={room.id}
                          borderWidth="1px"
                          borderColor={room.occupancy === 'OCCUPIED' ? 'warning.300' : 'mint.200'}
                          borderLeftWidth="4px"
                          borderRadius="md"
                          px={3}
                          py={2}
                          bg={room.occupancy === 'OCCUPIED' ? 'warning.50' : 'white'}
                        >
                          <HStack justify="space-between" align="flex-start">
                            <Box>
                              <Text fontSize="sm" fontWeight="bold">
                                Hab. {room.number}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                {room.roomType.name}
                                {room.floor !== null ? ` · piso ${room.floor}` : ''}
                              </Text>
                            </Box>
                            <Badge
                              colorScheme={room.occupancy === 'OCCUPIED' ? 'warning' : 'mint'}
                              textTransform="none"
                            >
                              {room.occupancy === 'OCCUPIED' ? 'Ocupada' : 'Libre'}
                            </Badge>
                          </HStack>
                          <HStack spacing={1} mt={2} wrap="wrap">
                            <StatusBadge
                              color={HOUSEKEEPING_COLORS[room.housekeepingState]}
                              label={HOUSEKEEPING_LABELS[room.housekeepingState]}
                            />
                            {room.operationalState !== 'AVAILABLE' && (
                              <StatusBadge
                                color={OPERATIONAL_COLORS[room.operationalState]}
                                label={OPERATIONAL_LABELS[room.operationalState]}
                              />
                            )}
                            {room.activeBlock !== null && (
                              <Badge colorScheme="danger" textTransform="none">
                                Bloqueo hasta {formatDateTime(room.activeBlock.endsAt)}
                              </Badge>
                            )}
                          </HStack>
                          {room.currentStay !== null ? (
                            <Box mt={2}>
                              <Text fontSize="xs" fontWeight="medium">
                                {room.currentStay.guestName}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                {room.currentStay.code} · salida{' '}
                                {formatCalendarDate(room.currentStay.checkOutDate)}
                              </Text>
                              <Button
                                size="xs"
                                variant="ghost"
                                mt={1}
                                onClick={() => {
                                  const stay = inHouse.find(
                                    (item) => item.id === room.currentStay?.id,
                                  );
                                  if (stay !== undefined) {
                                    openIncident(stay);
                                  }
                                }}
                              >
                                Registrar incidencia
                              </Button>
                            </Box>
                          ) : room.nextArrival !== null ? (
                            <Text fontSize="xs" color="gray.500" mt={2}>
                              Próxima llegada: {room.nextArrival.guestName} ·{' '}
                              {formatCalendarDate(room.nextArrival.checkInDate)}
                            </Text>
                          ) : (
                            <HStack justify="space-between" mt={2}>
                              <Text fontSize="xs" color="gray.400">
                                Sin estancia activa
                              </Text>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => openIncident(undefined, room)}
                              >
                                Nota
                              </Button>
                            </HStack>
                          )}
                        </Box>
                      ))}
                    </SimpleGrid>
                  </SectionCard>
                </TabPanel>

                <TabPanel px={0} hidden={data.isHistorical}>
                  <SectionCard>
                    <HStack justify="space-between" mb={3} wrap="wrap" gap={2}>
                      <Box>
                        <Text fontWeight="semibold">Incidencias y notas</Text>
                        <Text fontSize="xs" color="gray.500">
                          Registro operativo auditable, separado de la reserva.
                        </Text>
                      </Box>
                      <HStack>
                        <Select
                          size="sm"
                          width="150px"
                          aria-label="Estado de incidencias"
                          value={incidentFilter}
                          onChange={(event) =>
                            setIncidentFilter(event.target.value as IncidentStatus | '')
                          }
                        >
                          <option value="OPEN">Abiertas</option>
                          <option value="RESOLVED">Resueltas</option>
                          <option value="">Todas</option>
                        </Select>
                        <Button size="sm" colorScheme="brand" onClick={() => openIncident()}>
                          Nueva incidencia
                        </Button>
                      </HStack>
                    </HStack>

                    <QueryFeedback
                      loading={incidents.loading}
                      error={incidents.error}
                      onRetry={incidents.reload}
                      isEmpty={(incidents.data?.items.length ?? 0) === 0}
                      emptyText="No hay incidencias para el filtro seleccionado."
                    >
                      <Stack spacing={2}>
                        {incidents.data?.items.map((incident) => (
                          <Box
                            key={incident.id}
                            borderWidth="1px"
                            borderRadius="md"
                            borderLeftWidth="4px"
                            borderLeftColor={
                              incident.severity === 'HIGH'
                                ? 'danger.400'
                                : incident.severity === 'MEDIUM'
                                  ? 'warning.400'
                                  : 'sky.400'
                            }
                            px={3}
                            py={2}
                          >
                            <HStack justify="space-between" align="flex-start" wrap="wrap">
                              <Box>
                                <HStack spacing={2} wrap="wrap">
                                  <Text fontSize="sm" fontWeight="semibold">
                                    {incident.title}
                                  </Text>
                                  <StatusBadge
                                    color={incident.status === 'OPEN' ? 'warning' : 'mint'}
                                    label={INCIDENT_STATUS_LABELS[incident.status]}
                                  />
                                  <StatusBadge
                                    color={INCIDENT_SEVERITY_COLORS[incident.severity]}
                                    label={`Severidad ${INCIDENT_SEVERITY_LABELS[incident.severity]}`}
                                  />
                                  <Badge colorScheme="gray" textTransform="none">
                                    {INCIDENT_TYPE_LABELS[incident.type]}
                                  </Badge>
                                </HStack>
                                <Text fontSize="xs" color="gray.500" mt={1}>
                                  {incident.room !== null
                                    ? `Hab. ${incident.room.number}`
                                    : 'Sin habitación'}
                                  {incident.reservation !== null
                                    ? ` · ${incident.reservation.code}`
                                    : ''}
                                  {' · '}
                                  {formatDateTime(incident.createdAt)}
                                  {incident.createdBy !== null
                                    ? ` · ${incident.createdBy.name}`
                                    : ''}
                                </Text>
                                <Text fontSize="sm" mt={1} whiteSpace="pre-wrap">
                                  {incident.description}
                                </Text>
                                {incident.resolution !== null && (
                                  <Box mt={1} borderLeftWidth="2px" borderColor="mint.300" pl={2}>
                                    <Text fontSize="xs" color="gray.500">
                                      Resolución
                                      {incident.resolvedBy !== null
                                        ? ` · ${incident.resolvedBy.name}`
                                        : ''}{' '}
                                      · {formatDateTime(incident.resolvedAt)}
                                    </Text>
                                    <Text fontSize="xs">{incident.resolution}</Text>
                                  </Box>
                                )}
                              </Box>
                              {incident.status === 'OPEN' && (
                                <Button
                                  size="xs"
                                  variant="outline"
                                  colorScheme="mint"
                                  onClick={() => openResolve(incident)}
                                >
                                  Resolver
                                </Button>
                              )}
                            </HStack>
                          </Box>
                        ))}
                      </Stack>
                    </QueryFeedback>
                  </SectionCard>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Stack>
        )}
      </QueryFeedback>

      <CheckInWizard
        isOpen={checkInModal.isOpen}
        reservation={checkInTarget}
        tenant={tenant}
        onClose={() => {
          checkInModal.onClose();
          setCheckInTarget(null);
        }}
        onCompleted={reloadAll}
      />

      <Modal isOpen={checkoutModal.isOpen} onClose={checkoutModal.onClose} size="md">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleCheckOut(event)}>
          <ModalHeader>Check-out</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {checkoutTarget !== null && (
              <Stack spacing={3}>
                <Text fontSize="sm">
                  {checkoutTarget.guest.fullName} · Hab. {checkoutTarget.room.number} ·{' '}
                  {checkoutTarget.reservation.code}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  Se libera la habitación y la reserva queda como check-out. La operación es
                  idempotente y auditable.
                </Text>
                <Field label="Notas de salida" helper="Opcional, hasta 2000 caracteres.">
                  <Textarea
                    rows={3}
                    value={checkoutNotes}
                    maxLength={2000}
                    onChange={(event) => setCheckoutNotes(event.target.value)}
                  />
                </Field>
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={checkoutModal.onClose}>
              Cancelar
            </Button>
            <Button type="submit" colorScheme="brand" isLoading={busy?.startsWith('check-out')}>
              Confirmar check-out
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={moveModal.isOpen} onClose={moveModal.onClose} size="md">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleMove(event)}>
          <ModalHeader>Cambiar habitación</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {moveTarget !== null && (
              <Stack spacing={3}>
                <Text fontSize="sm">
                  {moveTarget.guest.fullName} · actual Hab. {moveTarget.room.number} ·{' '}
                  {moveTarget.reservation.nights} noches
                </Text>
                <Text fontSize="xs" color="gray.500">
                  Solo se ofrecen habitaciones libres del mismo tipo. Un cambio inválido es
                  rechazado por el backend.
                </Text>
                <Field label="Nueva habitación" isRequired>
                  <Select
                    value={moveRoomId}
                    onChange={(event) => setMoveRoomId(event.target.value)}
                    required
                  >
                    <option value="">Seleccionar…</option>
                    {moveCandidates.map((room) => (
                      <option key={room.id} value={room.id}>
                        Hab. {room.number} · {room.roomType.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                {moveCandidates.length === 0 && (
                  <Text fontSize="xs" color="warning.600">
                    No hay habitaciones libres del mismo tipo en este momento.
                  </Text>
                )}
                <Field label="Motivo" helper="Opcional, mínimo 3 caracteres.">
                  <Textarea
                    rows={2}
                    value={moveReason}
                    maxLength={500}
                    onChange={(event) => setMoveReason(event.target.value)}
                  />
                </Field>
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={moveModal.onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              colorScheme="brand"
              isLoading={busy?.startsWith('move')}
              isDisabled={moveRoomId === ''}
            >
              Cambiar habitación
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={noShowModal.isOpen} onClose={noShowModal.onClose} size="md">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleNoShow(event)}>
          <ModalHeader>Marcar no-show</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {noShowTarget !== null && (
              <Stack spacing={3}>
                <Text fontSize="sm">
                  {noShowTarget.guest.fullName} · {noShowTarget.code} · llegada{' '}
                  {formatCalendarDate(noShowTarget.checkInDate)}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  Solo se permite después de la fecha de llegada. La reserva queda como no-show y no
                  se elimina.
                </Text>
                <Field label="Motivo" helper="Opcional, mínimo 3 caracteres.">
                  <Textarea
                    rows={3}
                    value={noShowReason}
                    maxLength={500}
                    onChange={(event) => setNoShowReason(event.target.value)}
                  />
                </Field>
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={noShowModal.onClose}>
              Cancelar
            </Button>
            <Button type="submit" colorScheme="warning" isLoading={busy?.startsWith('no-show')}>
              Confirmar no-show
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={incidentModal.isOpen} onClose={incidentModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleCreateIncident(event)}>
          <ModalHeader>Nueva incidencia</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              {incidentTarget !== null && (
                <Text fontSize="sm">
                  Estancia: {incidentTarget.guest.fullName} · Hab. {incidentTarget.room.number}
                </Text>
              )}
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <Field label="Tipo">
                  <Select
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
                </Field>
                <Field label="Severidad">
                  <Select
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
                </Field>
              </SimpleGrid>
              <Field label="Título" isRequired helper="3–120 caracteres.">
                <Input
                  value={incidentForm.title}
                  maxLength={120}
                  onChange={(event) =>
                    setIncidentForm({ ...incidentForm, title: event.target.value })
                  }
                  required
                />
              </Field>
              <Field
                label="Descripción"
                isRequired
                helper="3–4000 caracteres. Sin datos sensibles."
              >
                <Textarea
                  rows={4}
                  value={incidentForm.description}
                  maxLength={4000}
                  onChange={(event) =>
                    setIncidentForm({ ...incidentForm, description: event.target.value })
                  }
                  required
                />
              </Field>
              {incidentTarget === null && (
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  <Field label="Alcance">
                    <Select
                      value={incidentForm.scope}
                      onChange={(event) =>
                        setIncidentForm({
                          ...incidentForm,
                          scope: event.target.value as IncidentScope,
                        })
                      }
                    >
                      <option value="none">Sin vínculo</option>
                      <option value="room">Habitación</option>
                      <option value="stay">Estancia</option>
                    </Select>
                  </Field>
                  {incidentForm.scope === 'room' && (
                    <Field label="Habitación">
                      <Select
                        value={incidentForm.roomId}
                        onChange={(event) =>
                          setIncidentForm({ ...incidentForm, roomId: event.target.value })
                        }
                      >
                        <option value="">Seleccionar…</option>
                        {data?.roomRack.map((room) => (
                          <option key={room.id} value={room.id}>
                            Hab. {room.number} · {room.roomType.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  {incidentForm.scope === 'stay' && (
                    <Field label="Estancia">
                      <Select
                        value={incidentForm.stayId}
                        onChange={(event) =>
                          setIncidentForm({ ...incidentForm, stayId: event.target.value })
                        }
                      >
                        <option value="">Seleccionar…</option>
                        {inHouse.map((stay) => (
                          <option key={stay.id} value={stay.id}>
                            Hab. {stay.room.number} · {stay.guest.fullName}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                </SimpleGrid>
              )}
              <Divider />
              <Text fontSize="xs" color="gray.500">
                La incidencia queda vinculada a la propiedad seleccionada y genera auditoría.
              </Text>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={incidentModal.onClose}>
              Cancelar
            </Button>
            <Button type="submit" colorScheme="brand" isLoading={busy === 'incident:create'}>
              Registrar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={resolveModal.isOpen} onClose={resolveModal.onClose} size="md">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleResolve(event)}>
          <ModalHeader>Resolver incidencia</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {resolveTarget !== null && (
              <Stack spacing={3}>
                <Text fontSize="sm" fontWeight="medium">
                  {resolveTarget.title}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {resolveTarget.description}
                </Text>
                <Field label="Resolución" isRequired helper="3–4000 caracteres.">
                  <Textarea
                    rows={4}
                    value={resolution}
                    maxLength={4000}
                    onChange={(event) => setResolution(event.target.value)}
                    required
                  />
                </Field>
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={resolveModal.onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              colorScheme="mint"
              isLoading={busy?.startsWith('incident:resolve')}
              isDisabled={resolution.trim().length < 3}
            >
              Resolver
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

export default function FrontOfficePage() {
  return (
    <PropertyGate>
      <FrontOfficeContent />
    </PropertyGate>
  );
}
