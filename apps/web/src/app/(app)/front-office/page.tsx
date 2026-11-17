'use client';

import {
  Badge,
  Box,
  Button,
  Checkbox,
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
import { api, errorMessage, isApiError } from '@/lib/api';
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
  formatMoney,
  todayISO,
} from '@/lib/format';
import type {
  CheckoutReadiness,
  FrontOfficeOverview,
  HousekeepingState,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  Reservation,
  ReservationStatus,
  RoomMoveBlockerCode,
  RoomMoveCandidate,
  RoomMoveCandidates,
  RoomRackItem,
  Stay,
} from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import {
  buildErrors,
  hasErrors,
  reasonField,
  type FieldErrors,
} from '@/lib/validation';

interface IncidentList {
  items: Incident[];
}

type IncidentScope = 'none' | 'stay' | 'room';

interface MoveFilters {
  roomTypeId: string;
  floor: string;
  building: string;
  housekeeping: '' | HousekeepingState;
  search: string;
  showIneligible: boolean;
}

const ROOM_MOVE_BLOCKER_LABELS: Record<RoomMoveBlockerCode, string> = {
  room_inactive: 'Habitación inactiva',
  room_out_of_service: 'Fuera de servicio',
  room_type_mismatch: 'Tipo distinto al de la reserva',
  room_block_overlap: 'Bloqueo operativo vigente',
  room_occupied: 'Ocupada por otra estancia',
  room_not_available: 'Reserva solapada',
};

/** Friendly, actionable version of the transaction's conflict codes. */
function roomMoveErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    switch (error.code) {
      case 'room_occupied':
        return 'Otra estancia ocupa esa habitación. Actualizamos las alternativas disponibles.';
      case 'room_block_overlap':
        return 'La habitación tiene un bloqueo operativo vigente. Elegí otra.';
      case 'room_not_available':
        return 'La habitación tiene una reserva solapada. Elegí otra.';
      case 'room_out_of_service':
        return 'La habitación no está operativamente disponible.';
      case 'room_type_mismatch':
        return 'La habitación no pertenece al tipo de la reserva.';
      case 'stay_not_in_house':
        return 'La estancia ya no está en casa. Actualizá el front office.';
    }
  }
  return errorMessage(error);
}

const TAB_INDEX: Record<string, number> = {
  arrivals: 0,
  'in-house': 1,
  departures: 2,
  rack: 3,
  incidents: 4,
};

interface SearchFilters {
  q: string;
  fromDate: string;
  toDate: string;
  status: ReservationStatus | '';
}

const EMPTY_SEARCH_FILTERS: SearchFilters = {
  q: '',
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
  const [checkoutReadiness, setCheckoutReadiness] = useState<CheckoutReadiness | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<unknown>(null);
  const [checkoutAllowBalance, setCheckoutAllowBalance] = useState(false);
  const [checkoutBalanceReason, setCheckoutBalanceReason] = useState('');

  const [checkInTarget, setCheckInTarget] = useState<Reservation | null>(null);

  const [moveTarget, setMoveTarget] = useState<Stay | null>(null);
  const [moveRoomId, setMoveRoomId] = useState('');
  const [moveReason, setMoveReason] = useState('');
  const [moveData, setMoveData] = useState<RoomMoveCandidates | null>(null);
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveError, setMoveError] = useState<unknown>(null);
  const [moveErrors, setMoveErrors] = useState<FieldErrors>({});
  const [moveFilters, setMoveFilters] = useState<MoveFilters>({
    roomTypeId: '',
    floor: '',
    building: '',
    housekeeping: '',
    search: '',
    showIneligible: false,
  });
  const [moveResult, setMoveResult] = useState<{ fromNumber: string; toNumber: string } | null>(
    null,
  );
  const moveRequestRef = useRef(0);

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

  function updateSearchInput<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]): void {
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
    setCheckoutReadiness(null);
    setCheckoutError(null);
    setCheckoutAllowBalance(false);
    setCheckoutBalanceReason('');
    checkoutModal.onOpen();
    setCheckoutLoading(true);
    void api<CheckoutReadiness>(`/api/v1/front-office/stays/${stay.id}/checkout-readiness`, {
      tenant,
    })
      .then((readiness) => setCheckoutReadiness(readiness))
      .catch((cause: unknown) => setCheckoutError(cause))
      .finally(() => setCheckoutLoading(false));
  }

  async function handleCheckOut(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (checkoutTarget === null) {
      return;
    }
    const target = checkoutTarget;
    const body: {
      notes?: string;
      allowOutstandingBalance?: boolean;
      balanceReason?: string;
    } = {};
    if (checkoutNotes.trim() !== '') {
      body.notes = checkoutNotes.trim();
    }
    if (checkoutAllowBalance) {
      if (checkoutBalanceReason.trim().length < 3) {
        toast({
          title: 'Indicá el motivo del saldo pendiente',
          description: 'El checkout con saldo pendiente requiere un motivo auditado.',
          status: 'warning',
        });
        return;
      }
      body.allowOutstandingBalance = true;
      body.balanceReason = checkoutBalanceReason.trim();
    }
    await run(
      `check-out:${target.id}`,
      () =>
        api(`/api/v1/front-office/stays/${target.id}/check-out`, {
          method: 'POST',
          tenant,
          body,
        }),
      `Check-out registrado para ${target.guest.fullName}`,
      checkoutModal.onClose,
    );
  }

  function openMove(stay: Stay): void {
    setMoveTarget(stay);
    setMoveRoomId('');
    setMoveReason('');
    setMoveData(null);
    setMoveError(null);
    setMoveErrors({});
    setMoveResult(null);
    setMoveFilters({
      roomTypeId: '',
      floor: '',
      building: '',
      housekeeping: '',
      search: '',
      showIneligible: false,
    });
    moveModal.onOpen();
    void loadMoveCandidates(stay.id, true);
  }

  async function loadMoveCandidates(stayId: string, resetFilters: boolean): Promise<void> {
    const requestId = moveRequestRef.current + 1;
    moveRequestRef.current = requestId;
    setMoveLoading(true);
    setMoveError(null);
    try {
      const payload = await api<RoomMoveCandidates>(
        `/api/v1/front-office/stays/${stayId}/room-move-candidates`,
        { tenant },
      );
      if (moveRequestRef.current !== requestId) {
        return;
      }
      setMoveData(payload);
      if (resetFilters) {
        setMoveFilters({
          roomTypeId: payload.stay.room.roomType.id,
          floor: '',
          building: '',
          housekeeping: '',
          search: '',
          showIneligible: false,
        });
      }
    } catch (cause) {
      if (moveRequestRef.current === requestId) {
        setMoveError(cause);
      }
    } finally {
      if (moveRequestRef.current === requestId) {
        setMoveLoading(false);
      }
    }
  }

  function updateMoveFilter<K extends keyof MoveFilters>(
    key: K,
    value: MoveFilters[K],
  ): void {
    setMoveFilters((current) => ({ ...current, [key]: value }));
    setMoveRoomId('');
  }

  async function handleMove(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (moveTarget === null || moveResult !== null) {
      return;
    }
    const nextErrors = buildErrors([
      ['move.roomId', moveRoomId === '' ? 'Elegí una habitación destino.' : null],
      ['move.reason', reasonField(moveReason, 'El motivo del cambio')],
    ]);
    setMoveErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    const target = moveTarget;
    setBusy(`move:${target.id}`);
    try {
      const updated = await api<Stay>(`/api/v1/front-office/stays/${target.id}/room-move`, {
        method: 'POST',
        tenant,
        body: { roomId: moveRoomId, reason: moveReason.trim() },
      });
      setMoveResult({ fromNumber: target.room.number, toNumber: updated.room.number });
      toast({
        title: `Habitación actualizada: ${target.room.number} → ${updated.room.number}`,
        status: 'success',
        duration: 6000,
      });
      reloadAll();
    } catch (cause) {
      toast({
        title: 'No se pudo cambiar la habitación',
        description: roomMoveErrorMessage(cause),
        status: 'error',
        duration: 8000,
      });
      setMoveRoomId('');
      void loadMoveCandidates(target.id, false);
    } finally {
      setBusy(null);
    }
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
  const moveRooms = moveData?.candidates ?? [];
  const moveRoomTypes = Array.from(
    new Map(moveRooms.map((room) => [room.roomType.id, room.roomType])).values(),
  );
  const moveFloors = Array.from(
    new Set(moveRooms.map((room) => room.floor).filter((value): value is string => value !== null)),
  ).sort();
  const moveBuildings = Array.from(
    new Set(
      moveRooms.map((room) => room.building).filter((value): value is string => value !== null),
    ),
  ).sort();
  const moveSearch = moveFilters.search.trim().toLowerCase();
  const filteredMoveCandidates = moveRooms.filter((room) => {
    if (moveFilters.roomTypeId !== '' && room.roomType.id !== moveFilters.roomTypeId) {
      return false;
    }
    if (moveFilters.floor !== '' && (room.floor ?? '') !== moveFilters.floor) {
      return false;
    }
    if (moveFilters.building !== '' && (room.building ?? '') !== moveFilters.building) {
      return false;
    }
    if (moveFilters.housekeeping !== '' && room.housekeepingState !== moveFilters.housekeeping) {
      return false;
    }
    if (moveSearch !== '' && !room.number.toLowerCase().includes(moveSearch)) {
      return false;
    }
    if (!moveFilters.showIneligible && !room.eligible) {
      return false;
    }
    return true;
  });
  const selectedMoveRoom: RoomMoveCandidate | null =
    moveRooms.find((room) => room.id === moveRoomId) ?? null;

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
            <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={3}>
              <Field label="Huésped, reserva o UH">
                <Input
                  value={searchInputs.q}
                  placeholder="Ej.: José, DEMO-1104, 201"
                  onChange={(event) => updateSearchInput('q', event.target.value)}
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
                      <Th position="sticky" right={0} bg="white" zIndex={1}>
                        Acciones
                      </Th>
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
                        <Td
                          position="sticky"
                          right={0}
                          bg="white"
                          zIndex={1}
                          borderLeftWidth="1px"
                          borderLeftColor="gray.100"
                        >
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
                  Cierra la cuenta y la estancia en una sola transacción, y deja la habitación
                  sucia. Si el cierre falla, la habitación no se libera.
                </Text>

                {checkoutLoading && (
                  <Text fontSize="sm" color="gray.500">
                    Revisando la cuenta…
                  </Text>
                )}
                {checkoutError !== null && (
                  <Text fontSize="sm" color="danger.600">
                    {errorMessage(checkoutError)}
                  </Text>
                )}

                {checkoutReadiness !== null &&
                  (() => {
                    const currency =
                      checkoutReadiness.folios[0]?.currencyCode ??
                      property?.currencyCode ??
                      'BRL';
                    const hasBalance = checkoutReadiness.totals.balance !== '0.00';
                    return (
                      <Box borderWidth="1px" borderColor="line" borderRadius="md" p={3}>
                        <Stack spacing={1}>
                          <HStack justify="space-between">
                            <Text fontSize="xs" color="gray.500">
                              Cargos
                            </Text>
                            <Text fontSize="sm">
                              {formatMoney(checkoutReadiness.totals.charges, currency)}
                            </Text>
                          </HStack>
                          <HStack justify="space-between">
                            <Text fontSize="xs" color="gray.500">
                              Pagos
                            </Text>
                            <Text fontSize="sm">
                              {formatMoney(checkoutReadiness.totals.payments, currency)}
                            </Text>
                          </HStack>
                          <HStack justify="space-between">
                            <Text fontSize="xs" color="gray.500">
                              Saldo
                            </Text>
                            <Text fontSize="sm" fontWeight="semibold">
                              {formatMoney(checkoutReadiness.totals.balance, currency)}
                            </Text>
                          </HStack>
                          <HStack justify="space-between">
                            <Text fontSize="xs" color="gray.500">
                              Housekeeping
                            </Text>
                            <Text fontSize="sm">
                              {HOUSEKEEPING_LABELS[checkoutReadiness.housekeeping.current]} →{' '}
                              {HOUSEKEEPING_LABELS[checkoutReadiness.housekeeping.target]}
                            </Text>
                          </HStack>
                        </Stack>

                        {checkoutReadiness.warnings.length > 0 && (
                          <Stack spacing={1} mt={3}>
                            {checkoutReadiness.warnings.map((warning) => (
                              <Text key={warning.code} fontSize="xs" color="warning.700">
                                {warning.message}
                              </Text>
                            ))}
                          </Stack>
                        )}
                        {checkoutReadiness.blockedReasons.length > 0 && (
                          <Stack spacing={1} mt={3}>
                            {checkoutReadiness.blockedReasons.map((reason) => (
                              <Text key={reason.code} fontSize="xs" color="danger.600">
                                {reason.message}
                              </Text>
                            ))}
                          </Stack>
                        )}

                        {hasBalance && (
                          <Stack spacing={2} mt={3}>
                            <Checkbox
                              size="sm"
                              isChecked={checkoutAllowBalance}
                              onChange={(event) => setCheckoutAllowBalance(event.target.checked)}
                            >
                              Autorizar checkout con saldo pendiente
                            </Checkbox>
                            {checkoutAllowBalance && (
                              <Field label="Motivo" isRequired helper="Queda auditado en la cuenta.">
                                <Textarea
                                  size="sm"
                                  rows={2}
                                  maxLength={500}
                                  value={checkoutBalanceReason}
                                  onChange={(event) =>
                                    setCheckoutBalanceReason(event.target.value)
                                  }
                                  required
                                />
                              </Field>
                            )}
                          </Stack>
                        )}
                      </Box>
                    );
                  })()}
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

      <Modal
        isOpen={moveModal.isOpen}
        onClose={moveModal.onClose}
        size="4xl"
        scrollBehavior="inside"
      >
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleMove(event)}>
          <ModalHeader>Cambiar habitación</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {moveResult !== null ? (
              <Stack spacing={3} align="center" py={8}>
                <Badge colorScheme="mint">Cambio registrado</Badge>
                <Text fontWeight="semibold">Habitación actualizada</Text>
                <HStack fontSize="xl" fontWeight="bold" spacing={3}>
                  <Text>Hab. {moveResult.fromNumber}</Text>
                  <Text color="gray.400">→</Text>
                  <Text>Hab. {moveResult.toNumber}</Text>
                </HStack>
                <Text fontSize="sm" color="gray.600" textAlign="center" maxW="380px">
                  La reserva, la estancia y el room rack ya reflejan la nueva habitación. El
                  motivo quedó auditado con actor, fecha y habitaciones de origen y destino.
                </Text>
              </Stack>
            ) : (
              moveTarget !== null && (
                <Stack spacing={4}>
                  <Box borderWidth="1px" borderColor="line" borderRadius="md" p={3}>
                    <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                      <Box>
                        <Text fontSize="xs" color="gray.500">
                          Huésped
                        </Text>
                        <Text fontSize="sm" fontWeight="semibold">
                          {moveTarget.guest.fullName}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          {moveTarget.reservation.code} ·{' '}
                          {formatCalendarDate(moveTarget.reservation.checkInDate)} →{' '}
                          {formatCalendarDate(moveTarget.reservation.checkOutDate)} ·{' '}
                          {moveTarget.reservation.nights} noches
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          {moveTarget.reservation.adults} adultos ·{' '}
                          {moveTarget.reservation.children} menores
                        </Text>
                      </Box>
                      <Box>
                        <Text fontSize="xs" color="gray.500">
                          Habitación actual
                        </Text>
                        <Text fontSize="sm" fontWeight="semibold">
                          Hab. {moveTarget.room.number} · {moveTarget.reservation.roomType.name}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          Piso {moveTarget.room.floor ?? '—'} · {moveTarget.room.building ?? '—'}
                        </Text>
                      </Box>
                    </SimpleGrid>
                  </Box>

                  {moveLoading && (
                    <Text fontSize="sm" color="gray.500">
                      Buscando habitaciones disponibles…
                    </Text>
                  )}
                  {moveError !== null && (
                    <Text fontSize="sm" color="danger.600">
                      {errorMessage(moveError)}
                    </Text>
                  )}

                  {moveData !== null && (
                    <>
                      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                        <Field label="Tipo">
                          <Select
                            size="sm"
                            value={moveFilters.roomTypeId}
                            onChange={(event) => updateMoveFilter('roomTypeId', event.target.value)}
                          >
                            <option value="">Todos</option>
                            {moveRoomTypes.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.name} ({type.capacityAdults}A/{type.capacityChildren}N)
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Piso">
                          <Select
                            size="sm"
                            value={moveFilters.floor}
                            onChange={(event) => updateMoveFilter('floor', event.target.value)}
                          >
                            <option value="">Todos</option>
                            {moveFloors.map((floor) => (
                              <option key={floor} value={floor}>
                                {floor}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Ala / edificio">
                          <Select
                            size="sm"
                            value={moveFilters.building}
                            onChange={(event) => updateMoveFilter('building', event.target.value)}
                          >
                            <option value="">Todas</option>
                            {moveBuildings.map((building) => (
                              <option key={building} value={building}>
                                {building}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Housekeeping">
                          <Select
                            size="sm"
                            value={moveFilters.housekeeping}
                            onChange={(event) =>
                              updateMoveFilter(
                                'housekeeping',
                                event.target.value as MoveFilters['housekeeping'],
                              )
                            }
                          >
                            <option value="">Todos</option>
                            {(
                              ['DIRTY', 'CLEANING', 'CLEAN', 'INSPECTED'] as HousekeepingState[]
                            ).map((state) => (
                              <option key={state} value={state}>
                                {HOUSEKEEPING_LABELS[state]}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </SimpleGrid>
                      <HStack spacing={3} wrap="wrap" align="flex-end" justify="space-between">
                        <Field label="Buscar UH">
                          <Input
                            size="sm"
                            width="160px"
                            value={moveFilters.search}
                            onChange={(event) => updateMoveFilter('search', event.target.value)}
                          />
                        </Field>
                        <Checkbox
                          size="sm"
                          isChecked={moveFilters.showIneligible}
                          onChange={(event) =>
                            updateMoveFilter('showIneligible', event.target.checked)
                          }
                        >
                          Mostrar no elegibles
                        </Checkbox>
                        <Text fontSize="xs" color="gray.500">
                          {filteredMoveCandidates.length} de {moveRooms.length} habitaciones
                        </Text>
                      </HStack>

                      {moveRooms.length === 0 ? (
                        <Text fontSize="sm" color="warning.700">
                          La propiedad no tiene otras habitaciones cargadas.
                        </Text>
                      ) : filteredMoveCandidates.length === 0 ? (
                        <Text fontSize="sm" color="warning.700">
                          No hay habitaciones que cumplan los filtros. Ajustá el tipo, el piso o el
                          estado de housekeeping.
                        </Text>
                      ) : (
                        <TableContainer
                          maxH="280px"
                          overflowY="auto"
                          borderWidth="1px"
                          borderColor="line"
                          borderRadius="md"
                        >
                          <Table size="sm">
                            <Thead>
                              <Tr>
                                <Th>UH</Th>
                                <Th>Tipo</Th>
                                <Th>Piso / ala</Th>
                                <Th>Housekeeping</Th>
                                <Th>Estado</Th>
                                <Th />
                              </Tr>
                            </Thead>
                            <Tbody>
                              {filteredMoveCandidates.map((room) => (
                                <Tr key={room.id} opacity={room.eligible ? 1 : 0.65}>
                                  <Td fontWeight="semibold">{room.number}</Td>
                                  <Td>
                                    <Text fontSize="xs">{room.roomType.name}</Text>
                                    <Text fontSize="xs" color="gray.500">
                                      {room.roomType.capacityAdults}A /{' '}
                                      {room.roomType.capacityChildren}N
                                    </Text>
                                  </Td>
                                  <Td>
                                    <Text fontSize="xs">{room.floor ?? '—'}</Text>
                                    <Text fontSize="xs" color="gray.500">
                                      {room.building ?? '—'}
                                    </Text>
                                  </Td>
                                  <Td>
                                    <StatusBadge
                                      color={HOUSEKEEPING_COLORS[room.housekeepingState]}
                                      label={HOUSEKEEPING_LABELS[room.housekeepingState]}
                                    />
                                  </Td>
                                  <Td>
                                    <Text fontSize="xs">
                                      {room.occupancy === 'OCCUPIED' ? 'Ocupada' : 'Libre'} ·{' '}
                                      {OPERATIONAL_LABELS[room.operationalState]}
                                    </Text>
                                    {room.activeBlock !== null && (
                                      <Text fontSize="xs" color="danger.600">
                                        Bloqueo {room.activeBlock.type} hasta{' '}
                                        {formatDateTime(room.activeBlock.endsAt)}
                                      </Text>
                                    )}
                                    {room.blockers.map((blocker) => (
                                      <Text key={blocker.code} fontSize="xs" color="danger.600">
                                        {ROOM_MOVE_BLOCKER_LABELS[blocker.code]}
                                      </Text>
                                    ))}
                                  </Td>
                                  <Td isNumeric>
                                    <Button
                                      size="xs"
                                      variant={moveRoomId === room.id ? 'solid' : 'outline'}
                                      colorScheme="brand"
                                      isDisabled={!room.eligible}
                                      onClick={() => {
                                        setMoveRoomId(room.id);
                                        setMoveErrors((current) => {
                                          const next = { ...current };
                                          delete next['move.roomId'];
                                          return next;
                                        });
                                      }}
                                    >
                                      {moveRoomId === room.id ? 'Elegida' : 'Elegir'}
                                    </Button>
                                  </Td>
                                </Tr>
                              ))}
                            </Tbody>
                          </Table>
                        </TableContainer>
                      )}
                      {moveErrors['move.roomId'] !== undefined && (
                        <Text fontSize="xs" color="danger.600">
                          {moveErrors['move.roomId']}
                        </Text>
                      )}

                      {selectedMoveRoom !== null && (
                        <Box borderWidth="1px" borderColor="line" borderRadius="md" p={3}>
                          <Text fontSize="sm" fontWeight="semibold" mb={2}>
                            Comparación
                          </Text>
                          <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                            <Box>
                              <Text fontSize="xs" color="gray.500">
                                Actual
                              </Text>
                              <Text fontSize="sm">
                                Hab. {moveData.stay.room.number} ·{' '}
                                {moveData.stay.room.roomType.name}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                Piso {moveData.stay.room.floor ?? '—'} ·{' '}
                                {moveData.stay.room.building ?? '—'} ·{' '}
                                {HOUSEKEEPING_LABELS[moveData.stay.room.housekeepingState]}
                              </Text>
                            </Box>
                            <Box>
                              <Text fontSize="xs" color="gray.500">
                                Destino
                              </Text>
                              <Text fontSize="sm">
                                Hab. {selectedMoveRoom.number} · {selectedMoveRoom.roomType.name}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                Piso {selectedMoveRoom.floor ?? '—'} ·{' '}
                                {selectedMoveRoom.building ?? '—'} ·{' '}
                                {HOUSEKEEPING_LABELS[selectedMoveRoom.housekeepingState]}
                              </Text>
                            </Box>
                          </SimpleGrid>
                          {selectedMoveRoom.warnings.map((warning) => (
                            <Text key={warning.code} fontSize="xs" color="warning.700" mt={2}>
                              Housekeeping: la habitación destino figura{' '}
                              {HOUSEKEEPING_LABELS[
                                selectedMoveRoom.housekeepingState
                              ].toLowerCase()}
                              . Conviene confirmar con gobernanta antes de mover al huésped.
                            </Text>
                          ))}
                        </Box>
                      )}

                      <Field
                        label="Motivo del cambio"
                        isRequired
                        error={moveErrors['move.reason']}
                        helper="Queda auditado con actor, fecha y habitaciones de origen y destino."
                      >
                        <Textarea
                          size="sm"
                          rows={2}
                          value={moveReason}
                          maxLength={500}
                          onChange={(event) => setMoveReason(event.target.value)}
                          required
                        />
                      </Field>
                    </>
                  )}
                </Stack>
              )
            )}
          </ModalBody>
          <ModalFooter>
            {moveResult !== null ? (
              <Button colorScheme="brand" onClick={moveModal.onClose}>
                Cerrar
              </Button>
            ) : (
              <>
                <Button variant="ghost" mr={3} onClick={moveModal.onClose}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  colorScheme="brand"
                  isLoading={busy === `move:${moveTarget?.id ?? ''}`}
                  isDisabled={moveRoomId === '' || moveLoading}
                >
                  Cambiar habitación
                </Button>
              </>
            )}
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
