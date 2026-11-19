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
import { ActionDialog } from '@/components/action-dialog';
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
import { useI18n } from '@/lib/i18n';
import {
  HOUSEKEEPING_COLORS,
  INCIDENT_SEVERITY_COLORS,
  OPERATIONAL_COLORS,
  RESERVATION_STATUS_COLORS,
  formatCalendarDate,
  formatDateTime,
  formatLongDate,
  formatMoney,
  housekeepingLabel,
  incidentSeverityLabel,
  incidentStatusLabel,
  incidentTypeLabel,
  occupancyLabel,
  reservationStatusLabel,
  roomOperationalLabel,
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
  RoomBlockType,
  RoomMoveBlockerCode,
  RoomMoveCandidate,
  RoomMoveCandidates,
  RoomRackItem,
  Stay,
} from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import { buildErrors, hasErrors, reasonField, type FieldErrors } from '@/lib/validation';

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

type Translator = ReturnType<typeof useI18n>['t'];

const INCIDENT_TYPES: IncidentType[] = ['NOTE', 'MAINTENANCE', 'COMPLAINT', 'SAFETY', 'OTHER'];

function roomMoveBlockerLabel(t: Translator, code: RoomMoveBlockerCode): string {
  switch (code) {
    case 'room_inactive':
      return t('frontOffice.move.blocker.roomInactive');
    case 'room_out_of_service':
      return t('frontOffice.move.blocker.outOfService');
    case 'room_type_mismatch':
      return t('frontOffice.move.blocker.typeMismatch');
    case 'room_block_overlap':
      return t('frontOffice.move.blocker.blockOverlap');
    case 'room_occupied':
      return t('frontOffice.move.blocker.occupied');
    case 'room_not_available':
      return t('frontOffice.move.blocker.notAvailable');
  }
}

function blockTypeLabel(t: Translator, type: RoomBlockType): string {
  return t(type === 'OUT_OF_ORDER' ? 'operational.outOfOrder' : 'operational.outOfService');
}

function nightsLabel(t: Translator, count: number): string {
  return t(count === 1 ? 'common.nightsOne' : 'common.nightsOther', { count });
}

function adultsLabel(t: Translator, count: number): string {
  return t(count === 1 ? 'common.adultsOne' : 'common.adultsOther', { count });
}

function minorsLabel(t: Translator, count: number): string {
  return t(count === 1 ? 'common.minorsOne' : 'common.minorsOther', { count });
}

/** Friendly, actionable version of the transaction's conflict codes. */
function roomMoveErrorMessage(error: unknown, t: Translator): string {
  if (isApiError(error)) {
    switch (error.code) {
      case 'room_occupied':
        return t('frontOffice.move.error.occupied');
      case 'room_block_overlap':
        return t('frontOffice.move.error.blockOverlap');
      case 'room_not_available':
        return t('frontOffice.move.error.notAvailable');
      case 'room_out_of_service':
        return t('frontOffice.move.error.outOfService');
      case 'room_type_mismatch':
        return t('frontOffice.move.error.typeMismatch');
      case 'stay_not_in_house':
        return t('frontOffice.move.error.stayNotInHouse');
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
  const { t } = useI18n();
  return (
    <Box borderWidth="1px" borderRadius="md" px={3} py={2}>
      <HStack justify="space-between" align="flex-start" wrap="wrap">
        <Box>
          <Text fontSize="sm" fontWeight="semibold">
            {t('frontOffice.stay.card', {
              number: stay.room.number,
              name: stay.guest.fullName,
            })}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {stay.reservation.code} ·{' '}
            {t('frontOffice.stay.checkout', {
              date: formatCalendarDate(stay.reservation.checkOutDate),
            })}
            {stay.moveCount > 0
              ? ` · ${t('frontOffice.stay.moves', { count: stay.moveCount })}`
              : ''}
            {stay.checkedOutAt !== null
              ? ` · ${t('frontOffice.stay.checkedOut', { time: formatDateTime(stay.checkedOutAt) })}`
              : ''}
          </Text>
        </Box>
        <StatusBadge
          color={stay.status === 'CHECKED_OUT' ? 'sky' : 'mint'}
          label={t(
            stay.status === 'CHECKED_OUT'
              ? 'frontOffice.stay.statusOut'
              : 'frontOffice.stay.statusIn',
          )}
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
              {t('frontOffice.action.checkOut')}
            </Button>
            <Button size="xs" variant="outline" onClick={() => onMove(stay)}>
              {t('frontOffice.action.move')}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => onIncident(stay)}>
              {t('frontOffice.action.incident')}
            </Button>
          </>
        )}
        <ReservationDocuments
          reservationId={stay.reservation.id}
          reservationCode={stay.reservation.code}
        />
        <Button as={NextLink} href="/reservations" size="xs" variant="ghost">
          {t('frontOffice.action.reservation')}
        </Button>
      </HStack>
    </Box>
  );
}

function FrontOfficeContent() {
  const { tenant, property } = useSession();
  const { t, locale } = useI18n();
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
  const [moveActionError, setMoveActionError] = useState<unknown>(null);
  const moveRequestRef = useRef(0);

  const [noShowTarget, setNoShowTarget] = useState<Reservation | null>(null);
  const [noShowReason, setNoShowReason] = useState('');
  const [noShowError, setNoShowError] = useState<unknown>(null);

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
  const [resolveError, setResolveError] = useState<unknown>(null);

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
        title: t('frontOffice.error.generic'),
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
        status !== null && Object.prototype.hasOwnProperty.call(RESERVATION_STATUS_COLORS, status)
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

  async function handleCheckOut(): Promise<void> {
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
          title: t('frontOffice.checkout.balanceTitle'),
          description: t('frontOffice.checkout.balanceHelp'),
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
      t('frontOffice.checkout.success', { name: target.guest.fullName }),
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
    setMoveActionError(null);
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

  function updateMoveFilter<K extends keyof MoveFilters>(key: K, value: MoveFilters[K]): void {
    setMoveFilters((current) => ({ ...current, [key]: value }));
    setMoveRoomId('');
  }

  async function handleMove(): Promise<void> {
    if (moveTarget === null || moveResult !== null) {
      return;
    }
    const nextErrors = buildErrors([
      ['move.roomId', moveRoomId === '' ? t('frontOffice.move.roomRequired') : null],
      ['move.reason', reasonField(moveReason, t('frontOffice.move.reasonField'))],
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
        title: t('frontOffice.move.success', {
          from: target.room.number,
          to: updated.room.number,
        }),
        status: 'success',
        duration: 6000,
      });
      reloadAll();
    } catch (cause) {
      // The dialog keeps the context and shows the mapped conflict; the
      // candidate list is refreshed so the operator can pick another room.
      setMoveActionError(cause);
      setMoveRoomId('');
      void loadMoveCandidates(target.id, false);
    } finally {
      setBusy(null);
    }
  }

  function openNoShow(reservation: Reservation): void {
    setNoShowTarget(reservation);
    setNoShowReason('');
    setNoShowError(null);
    noShowModal.onOpen();
  }

  async function handleNoShow(): Promise<void> {
    if (noShowTarget === null) {
      return;
    }
    const target = noShowTarget;
    setBusy(`no-show:${target.id}`);
    setNoShowError(null);
    try {
      await api(`/api/v1/front-office/reservations/${target.id}/no-show`, {
        method: 'POST',
        tenant,
        body: {
          ...(noShowReason.trim().length >= 3 ? { reason: noShowReason.trim() } : {}),
        },
      });
      toast({ title: t('frontOffice.noShow.success'), status: 'success' });
      noShowModal.onClose();
      reloadAll();
    } catch (cause) {
      setNoShowError(cause);
    } finally {
      setBusy(null);
    }
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
      toast({ title: t('frontOffice.incidentForm.invalid'), status: 'warning' });
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
      t('frontOffice.incidentForm.created'),
      incidentModal.onClose,
    );
  }

  function openResolve(incident: Incident): void {
    setResolveTarget(incident);
    setResolution('');
    setResolveError(null);
    resolveModal.onOpen();
  }

  async function handleResolve(): Promise<void> {
    if (resolveTarget === null || resolution.trim().length < 3) {
      toast({ title: t('frontOffice.resolve.tooShort'), status: 'warning' });
      return;
    }
    const target = resolveTarget;
    setBusy(`incident:resolve:${target.id}`);
    setResolveError(null);
    try {
      await api(`/api/v1/front-office/incidents/${target.id}/resolve`, {
        method: 'POST',
        tenant,
        body: { resolution: resolution.trim() },
      });
      toast({ title: t('frontOffice.resolve.done'), status: 'success' });
      resolveModal.onClose();
      reloadAll();
    } catch (cause) {
      setResolveError(cause);
    } finally {
      setBusy(null);
    }
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
              ? t('frontOffice.description.historical', {
                  date: formatLongDate(data.selectedDate),
                })
              : t('frontOffice.description.operational', {
                  date: formatCalendarDate(data.operationalDate),
                  time: data.localTime,
                  timezone: data.timezone,
                  start: data.operationalDayStart,
                })
            : t('frontOffice.description.default')
        }
        actions={
          <HStack spacing={2} wrap="wrap">
            <DateField
              value={referenceDate}
              onChange={changeDate}
              placeholder={t('frontOffice.date.placeholder')}
              ariaLabel={t('frontOffice.date.aria')}
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
              {t('frontOffice.action.today')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={reloadAll}
              isLoading={overview.loading && data !== null}
            >
              {t('frontOffice.action.refresh')}
            </Button>
          </HStack>
        }
      />

      <SectionCard mb={6}>
        <form onSubmit={applySearch}>
          <Stack spacing={3}>
            <HStack justify="space-between" wrap="wrap">
              <Box>
                <Text fontWeight="semibold">{t('frontOffice.search.title')}</Text>
                <Text fontSize="xs" color="gray.500">
                  {t('frontOffice.search.help')}
                </Text>
              </Box>
              {searchActive && (
                <Button size="xs" variant="ghost" onClick={clearSearch}>
                  {t('frontOffice.action.clearFilters')}
                </Button>
              )}
            </HStack>
            <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={3}>
              <Field label={t('frontOffice.search.guestLabel')}>
                <Input
                  value={searchInputs.q}
                  placeholder={t('frontOffice.search.guestPlaceholder')}
                  onChange={(event) => updateSearchInput('q', event.target.value)}
                />
              </Field>
              <Field label={t('frontOffice.search.from')}>
                <DateField
                  value={searchInputs.fromDate}
                  onChange={(value) => updateSearchInput('fromDate', value)}
                  placeholder={t('frontOffice.search.anyDate')}
                  ariaLabel={t('frontOffice.search.from')}
                />
              </Field>
              <Field label={t('frontOffice.search.to')}>
                <DateField
                  value={searchInputs.toDate}
                  onChange={(value) => updateSearchInput('toDate', value)}
                  placeholder={t('frontOffice.search.anyDate')}
                  ariaLabel={t('frontOffice.search.to')}
                />
              </Field>
              <Field label={t('frontOffice.search.status')}>
                <Select
                  value={searchInputs.status}
                  onChange={(event) =>
                    updateSearchInput('status', event.target.value as ReservationStatus | '')
                  }
                >
                  <option value="">{t('frontOffice.search.allStatuses')}</option>
                  {(Object.keys(RESERVATION_STATUS_COLORS) as ReservationStatus[]).map((value) => (
                    <option key={value} value={value}>
                      {reservationStatusLabel(locale, value)}
                    </option>
                  ))}
                </Select>
              </Field>
            </SimpleGrid>
            <HStack justify="space-between" wrap="wrap">
              <Text fontSize="xs" color="gray.500">
                {t('frontOffice.search.datesHint')}
              </Text>
              <Button type="submit" size="sm" colorScheme="brand" isLoading={searchLoading}>
                {t('frontOffice.action.search')}
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
              emptyText={t('frontOffice.search.empty')}
            >
              <TableContainer overflowX="auto">
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>{t('frontOffice.table.guest')}</Th>
                      <Th>{t('frontOffice.table.reservation')}</Th>
                      <Th>{t('frontOffice.table.room')}</Th>
                      <Th>{t('frontOffice.table.arrival')}</Th>
                      <Th>{t('frontOffice.table.departure')}</Th>
                      <Th>{t('frontOffice.table.status')}</Th>
                      <Th>{t('frontOffice.table.type')}</Th>
                      <Th position="sticky" right={0} bg="white" zIndex={1}>
                        {t('frontOffice.table.actions')}
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
                        <Td>{reservation.room?.number ?? t('frontOffice.table.noRoom')}</Td>
                        <Td>{formatCalendarDate(reservation.checkInDate)}</Td>
                        <Td>{formatCalendarDate(reservation.checkOutDate)}</Td>
                        <Td>
                          <StatusBadge
                            color={RESERVATION_STATUS_COLORS[reservation.status] ?? 'gray'}
                            label={reservationStatusLabel(locale, reservation.status)}
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
                              {t('frontOffice.action.open')}
                            </Button>
                            <Button
                              as={NextLink}
                              href={`/guests?search=${encodeURIComponent(reservation.guest.fullName)}`}
                              size="xs"
                              variant="ghost"
                            >
                              {t('frontOffice.table.guest')}
                            </Button>
                            {reservation.status === 'CONFIRMED' && (
                              <Button
                                size="xs"
                                colorScheme="brand"
                                onClick={() => openGuidedCheckIn(reservation)}
                              >
                                {t('frontOffice.action.checkIn')}
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
                    {t('frontOffice.action.loadMore')}
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
        emptyText={t('frontOffice.board.loadError')}
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
                  {t('frontOffice.historical.badge')}
                </Badge>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" color="warning.800">
                    {formatLongDate(data.selectedDate)}
                  </Text>
                  <Text fontSize="xs" color="warning.700">
                    {t('frontOffice.historical.note')}
                  </Text>
                </Box>
              </HStack>
            )}

            <SimpleGrid columns={{ base: 2, md: 3, xl: data.isHistorical ? 4 : 6 }} spacing={3}>
              <MetricCard
                label={t('frontOffice.metric.arrivals')}
                value={data.counts.arrivals}
                accent="sky"
              />
              <MetricCard
                label={t(
                  data.isHistorical ? 'frontOffice.metric.hosted' : 'frontOffice.metric.inHouse',
                )}
                value={data.counts.inHouse}
                accent="mint"
              />
              <MetricCard
                label={t('frontOffice.metric.departures')}
                value={data.counts.departures}
                accent="warning"
              />
              {data.isHistorical ? (
                <MetricCard
                  label={t('frontOffice.metric.noShow')}
                  value={data.counts.noShowCandidates}
                  hint={t('frontOffice.metric.noShowHint')}
                  accent="danger"
                />
              ) : (
                <>
                  <MetricCard
                    label={t('frontOffice.metric.free')}
                    value={data.counts.vacantRooms}
                    accent="mint"
                  />
                  <MetricCard
                    label={t('frontOffice.metric.occupied')}
                    value={data.counts.occupiedRooms}
                    accent="brand"
                  />
                  <MetricCard
                    label={t('frontOffice.metric.noShowPending')}
                    value={data.counts.noShowCandidates}
                    hint={t('frontOffice.metric.noShowPendingHint')}
                    accent="danger"
                  />
                </>
              )}
            </SimpleGrid>

            <Tabs colorScheme="brand" index={tabIndex} onChange={setTabIndex} isLazy>
              <TabList>
                <Tab>
                  {t('frontOffice.tab.arrivals')} ({data.counts.arrivals})
                </Tab>
                <Tab>
                  {t(data.isHistorical ? 'frontOffice.tab.hosted' : 'frontOffice.tab.inHouse')} (
                  {data.counts.inHouse})
                </Tab>
                <Tab>
                  {t('frontOffice.tab.departures')} ({data.counts.departures})
                </Tab>
                {!data.isHistorical && (
                  <Tab>
                    {t('frontOffice.tab.rack')} ({data.roomRack.length})
                  </Tab>
                )}
                {!data.isHistorical && <Tab>{t('frontOffice.tab.incidents')}</Tab>}
              </TabList>

              <TabPanels>
                <TabPanel px={0}>
                  <SectionCard>
                    <Text fontWeight="semibold" mb={1}>
                      {data.isHistorical
                        ? t('frontOffice.arrivals.titleHistorical', {
                            date: formatCalendarDate(data.selectedDate),
                          })
                        : t('frontOffice.arrivals.titleOperational')}
                    </Text>
                    <Text fontSize="xs" color="gray.500" mb={3}>
                      {data.isHistorical
                        ? t('frontOffice.arrivals.helpHistorical')
                        : t('frontOffice.arrivals.helpOperational', {
                            date: formatCalendarDate(operationalDate),
                          })}
                    </Text>
                    <QueryFeedback
                      loading={false}
                      error={null}
                      isEmpty={data.arrivals.length === 0}
                      emptyText={
                        data.isHistorical
                          ? t('frontOffice.arrivals.emptyHistorical')
                          : t('frontOffice.arrivals.emptyOperational')
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
                                      label={reservationStatusLabel(locale, reservation.status)}
                                    />
                                    {late && (
                                      <Badge colorScheme="warning" textTransform="none">
                                        {t('frontOffice.badge.late')}
                                      </Badge>
                                    )}
                                    {missingRoom && (
                                      <Badge colorScheme="danger" textTransform="none">
                                        {t('frontOffice.badge.noRoom')}
                                      </Badge>
                                    )}
                                  </HStack>
                                  <Text fontSize="xs" color="gray.500">
                                    {reservation.code} · {reservation.roomType.name} ·{' '}
                                    {formatCalendarDate(reservation.checkInDate)} →{' '}
                                    {formatCalendarDate(reservation.checkOutDate)} ·{' '}
                                    {nightsLabel(t, reservation.nights)}
                                  </Text>
                                  <Text fontSize="xs" color="gray.500">
                                    {t('frontOffice.arrivals.roomLabel')}{' '}
                                    {reservation.room !== null
                                      ? reservation.room.number
                                      : t('frontOffice.arrivals.unassigned')}{' '}
                                    · {adultsLabel(t, reservation.adults)}
                                    {reservation.children > 0
                                      ? ` · ${minorsLabel(t, reservation.children)}`
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
                                      {t('frontOffice.action.checkIn')}
                                    </Button>
                                  )}
                                  {!data.isHistorical && late && (
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      colorScheme="warning"
                                      onClick={() => openNoShow(reservation)}
                                    >
                                      {t('frontOffice.action.noShow')}
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
                      {t(
                        data.isHistorical
                          ? 'frontOffice.inHouse.titleHistorical'
                          : 'frontOffice.inHouse.titleOperational',
                      )}
                    </Text>
                    <Text fontSize="xs" color="gray.500" mb={3}>
                      {t(
                        data.isHistorical
                          ? 'frontOffice.inHouse.helpHistorical'
                          : 'frontOffice.inHouse.helpOperational',
                      )}
                    </Text>
                    <QueryFeedback
                      loading={false}
                      error={null}
                      isEmpty={inHouse.length === 0}
                      emptyText={
                        data.isHistorical
                          ? t('frontOffice.inHouse.emptyHistorical')
                          : t('frontOffice.inHouse.emptyOperational')
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
                      {t(
                        data.isHistorical
                          ? 'frontOffice.departures.titleHistorical'
                          : 'frontOffice.departures.titleOperational',
                      )}
                    </Text>
                    <Text fontSize="xs" color="gray.500" mb={3}>
                      {t(
                        data.isHistorical
                          ? 'frontOffice.departures.helpHistorical'
                          : 'frontOffice.departures.helpOperational',
                      )}
                    </Text>
                    <QueryFeedback
                      loading={false}
                      error={null}
                      isEmpty={data.departures.length === 0}
                      emptyText={
                        data.isHistorical
                          ? t('frontOffice.departures.emptyHistorical')
                          : t('frontOffice.departures.emptyOperational')
                      }
                    >
                      <Stack spacing={2}>
                        {data.departures.map((stay) => (
                          <Box key={stay.id} borderWidth="1px" borderRadius="md" px={3} py={2}>
                            <HStack justify="space-between" align="flex-start" wrap="wrap">
                              <Box>
                                <Text fontSize="sm" fontWeight="semibold">
                                  {t('frontOffice.stay.card', {
                                    number: stay.room.number,
                                    name: stay.guest.fullName,
                                  })}
                                </Text>
                                <Text fontSize="xs" color="gray.500">
                                  {stay.reservation.code} ·{' '}
                                  {t('frontOffice.stay.checkout', {
                                    date: formatCalendarDate(stay.reservation.checkOutDate),
                                  })}{' '}
                                  · check-in {formatDateTime(stay.checkedInAt)}
                                  {stay.checkedOutAt !== null
                                    ? ` · ${t('frontOffice.stay.checkedOut', {
                                        time: formatDateTime(stay.checkedOutAt),
                                      })}`
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
                                    {t('frontOffice.action.checkOut')}
                                  </Button>
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    onClick={() => openIncident(stay)}
                                  >
                                    {t('frontOffice.action.incident')}
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
                        <Text fontWeight="semibold">{t('frontOffice.rack.title')}</Text>
                        <Text fontSize="xs" color="gray.500">
                          {t('frontOffice.rack.help')}
                        </Text>
                      </Box>
                      <HStack spacing={3}>
                        <HStack spacing={1}>
                          <Box boxSize="10px" borderRadius="full" bg="mint.500" />
                          <Text fontSize="xs" color="gray.600">
                            {t('frontOffice.rack.free')}
                          </Text>
                        </HStack>
                        <HStack spacing={1}>
                          <Box boxSize="10px" borderRadius="full" bg="warning.500" />
                          <Text fontSize="xs" color="gray.600">
                            {t('frontOffice.rack.occupied')}
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
                                {t('frontOffice.rack.room', { number: room.number })}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                {room.roomType.name}
                                {room.floor !== null
                                  ? t('frontOffice.rack.floor', { floor: room.floor })
                                  : ''}
                              </Text>
                            </Box>
                            <Badge
                              colorScheme={room.occupancy === 'OCCUPIED' ? 'warning' : 'mint'}
                              textTransform="none"
                            >
                              {occupancyLabel(locale, room.occupancy)}
                            </Badge>
                          </HStack>
                          <HStack spacing={1} mt={2} wrap="wrap">
                            <StatusBadge
                              color={HOUSEKEEPING_COLORS[room.housekeepingState]}
                              label={housekeepingLabel(locale, room.housekeepingState)}
                            />
                            {room.operationalState !== 'AVAILABLE' && (
                              <StatusBadge
                                color={OPERATIONAL_COLORS[room.operationalState]}
                                label={roomOperationalLabel(locale, room.operationalState)}
                              />
                            )}
                            {room.activeBlock !== null && (
                              <Badge colorScheme="danger" textTransform="none">
                                {t('frontOffice.rack.block', {
                                  time: formatDateTime(room.activeBlock.endsAt),
                                })}
                              </Badge>
                            )}
                          </HStack>
                          {room.currentStay !== null ? (
                            <Box mt={2}>
                              <Text fontSize="xs" fontWeight="medium">
                                {room.currentStay.guestName}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                {room.currentStay.code} ·{' '}
                                {t('frontOffice.stay.checkout', {
                                  date: formatCalendarDate(room.currentStay.checkOutDate),
                                })}
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
                                {t('frontOffice.rack.registerIncident')}
                              </Button>
                            </Box>
                          ) : room.nextArrival !== null ? (
                            <Text fontSize="xs" color="gray.500" mt={2}>
                              {t('frontOffice.rack.nextArrival', {
                                name: room.nextArrival.guestName,
                                date: formatCalendarDate(room.nextArrival.checkInDate),
                              })}
                            </Text>
                          ) : (
                            <HStack justify="space-between" mt={2}>
                              <Text fontSize="xs" color="gray.400">
                                {t('frontOffice.rack.noStay')}
                              </Text>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => openIncident(undefined, room)}
                              >
                                {t('frontOffice.rack.note')}
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
                        <Text fontWeight="semibold">{t('frontOffice.incidents.title')}</Text>
                        <Text fontSize="xs" color="gray.500">
                          {t('frontOffice.incidents.help')}
                        </Text>
                      </Box>
                      <HStack>
                        <Select
                          size="sm"
                          width="150px"
                          aria-label={t('frontOffice.incidents.statusAria')}
                          value={incidentFilter}
                          onChange={(event) =>
                            setIncidentFilter(event.target.value as IncidentStatus | '')
                          }
                        >
                          <option value="OPEN">{t('frontOffice.incidents.filterOpen')}</option>
                          <option value="RESOLVED">
                            {t('frontOffice.incidents.filterResolved')}
                          </option>
                          <option value="">{t('frontOffice.incidents.filterAll')}</option>
                        </Select>
                        <Button size="sm" colorScheme="brand" onClick={() => openIncident()}>
                          {t('frontOffice.incidents.new')}
                        </Button>
                      </HStack>
                    </HStack>

                    <QueryFeedback
                      loading={incidents.loading}
                      error={incidents.error}
                      onRetry={incidents.reload}
                      isEmpty={(incidents.data?.items.length ?? 0) === 0}
                      emptyText={t('frontOffice.incidents.empty')}
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
                                    label={incidentStatusLabel(locale, incident.status)}
                                  />
                                  <StatusBadge
                                    color={INCIDENT_SEVERITY_COLORS[incident.severity]}
                                    label={t('frontOffice.incidents.severity', {
                                      level: incidentSeverityLabel(locale, incident.severity),
                                    })}
                                  />
                                  <Badge colorScheme="gray" textTransform="none">
                                    {incidentTypeLabel(locale, incident.type)}
                                  </Badge>
                                </HStack>
                                <Text fontSize="xs" color="gray.500" mt={1}>
                                  {incident.room !== null
                                    ? t('frontOffice.rack.room', { number: incident.room.number })
                                    : t('frontOffice.incidents.noRoom')}
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
                                      {t('frontOffice.incidents.resolution')}
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
                                  {t('frontOffice.incidents.resolve')}
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

      <ActionDialog
        isOpen={checkoutModal.isOpen}
        onClose={checkoutModal.onClose}
        tone="critical"
        title={t('frontOffice.checkout.title')}
        summary={t('frontOffice.checkout.summary')}
        confirmLabel={t('frontOffice.checkout.confirm')}
        onConfirm={() => void handleCheckOut()}
        isLoading={busy?.startsWith('check-out') === true}
        hasUnsavedChanges={checkoutNotes.trim() !== '' || checkoutBalanceReason.trim() !== ''}
        error={checkoutError === null ? undefined : errorMessage(checkoutError)}
      >
        {checkoutTarget !== null && (
          <Stack spacing={3}>
            <Text fontSize="sm">
              {checkoutTarget.guest.fullName} · Hab. {checkoutTarget.room.number} ·{' '}
              {checkoutTarget.reservation.code}
            </Text>

            {checkoutLoading && (
              <Text fontSize="sm" color="gray.500">
                {t('frontOffice.checkout.loading')}
              </Text>
            )}
            {checkoutReadiness !== null &&
              (() => {
                const currency =
                  checkoutReadiness.folios[0]?.currencyCode ?? property?.currencyCode ?? 'BRL';
                const hasBalance = checkoutReadiness.totals.balance !== '0.00';
                return (
                  <Box borderWidth="1px" borderColor="line" borderRadius="md" p={3}>
                    <Stack spacing={1}>
                      <HStack justify="space-between">
                        <Text fontSize="xs" color="gray.500">
                          {t('frontOffice.checkout.charges')}
                        </Text>
                        <Text fontSize="sm">
                          {formatMoney(checkoutReadiness.totals.charges, currency)}
                        </Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="xs" color="gray.500">
                          {t('frontOffice.checkout.payments')}
                        </Text>
                        <Text fontSize="sm">
                          {formatMoney(checkoutReadiness.totals.payments, currency)}
                        </Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="xs" color="gray.500">
                          {t('frontOffice.checkout.balance')}
                        </Text>
                        <Text fontSize="sm" fontWeight="semibold">
                          {formatMoney(checkoutReadiness.totals.balance, currency)}
                        </Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="xs" color="gray.500">
                          {t('frontOffice.checkout.housekeeping')}
                        </Text>
                        <Text fontSize="sm">
                          {housekeepingLabel(locale, checkoutReadiness.housekeeping.current)} →{' '}
                          {housekeepingLabel(locale, checkoutReadiness.housekeeping.target)}
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
                          {t('frontOffice.checkout.allowBalance')}
                        </Checkbox>
                        {checkoutAllowBalance && (
                          <Field
                            label={t('frontOffice.checkout.reason')}
                            isRequired
                            helper={t('frontOffice.checkout.reasonHelper')}
                          >
                            <Textarea
                              size="sm"
                              rows={2}
                              maxLength={500}
                              value={checkoutBalanceReason}
                              onChange={(event) => setCheckoutBalanceReason(event.target.value)}
                              required
                            />
                          </Field>
                        )}
                      </Stack>
                    )}
                  </Box>
                );
              })()}
            <Field
              label={t('frontOffice.checkout.notes')}
              helper={t('frontOffice.checkout.notesHelper')}
            >
              <Textarea
                rows={3}
                value={checkoutNotes}
                maxLength={2000}
                onChange={(event) => setCheckoutNotes(event.target.value)}
              />
            </Field>
          </Stack>
        )}
      </ActionDialog>

      <ActionDialog
        isOpen={moveModal.isOpen}
        onClose={moveModal.onClose}
        size="4xl"
        tone="info"
        title={t('frontOffice.move.title')}
        summary={
          moveResult !== null ? t('frontOffice.move.summaryDone') : t('frontOffice.move.summary')
        }
        confirmLabel={
          moveResult !== null ? t('frontOffice.move.close') : t('frontOffice.move.confirm')
        }
        hideCancel={moveResult !== null}
        hasUnsavedChanges={moveReason.trim() !== ''}
        error={moveActionError === null ? undefined : roomMoveErrorMessage(moveActionError, t)}
        onConfirm={moveResult !== null ? moveModal.onClose : () => void handleMove()}
        isLoading={busy === `move:${moveTarget?.id ?? ''}`}
        confirmDisabled={moveResult === null && (moveRoomId === '' || moveLoading)}
      >
        {moveResult !== null ? (
          <Stack spacing={3} align="center" py={8}>
            <Badge colorScheme="mint">{t('frontOffice.move.doneBadge')}</Badge>
            <Text fontWeight="semibold">{t('frontOffice.move.doneTitle')}</Text>
            <HStack fontSize="xl" fontWeight="bold" spacing={3}>
              <Text>{t('frontOffice.rack.room', { number: moveResult.fromNumber })}</Text>
              <Text color="gray.400">→</Text>
              <Text>{t('frontOffice.rack.room', { number: moveResult.toNumber })}</Text>
            </HStack>
            <Text fontSize="sm" color="gray.600" textAlign="center" maxW="380px">
              {t('frontOffice.move.doneNote')}
            </Text>
          </Stack>
        ) : (
          moveTarget !== null && (
            <Stack spacing={4}>
              <Box borderWidth="1px" borderColor="line" borderRadius="md" p={3}>
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                  <Box>
                    <Text fontSize="xs" color="gray.500">
                      {t('frontOffice.move.guest')}
                    </Text>
                    <Text fontSize="sm" fontWeight="semibold">
                      {moveTarget.guest.fullName}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {moveTarget.reservation.code} ·{' '}
                      {formatCalendarDate(moveTarget.reservation.checkInDate)} →{' '}
                      {formatCalendarDate(moveTarget.reservation.checkOutDate)} ·{' '}
                      {nightsLabel(t, moveTarget.reservation.nights)}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {adultsLabel(t, moveTarget.reservation.adults)} ·{' '}
                      {minorsLabel(t, moveTarget.reservation.children)}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500">
                      {t('frontOffice.move.currentRoom')}
                    </Text>
                    <Text fontSize="sm" fontWeight="semibold">
                      {t('frontOffice.rack.room', { number: moveTarget.room.number })} ·{' '}
                      {moveTarget.reservation.roomType.name}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {t('frontOffice.move.floor', {
                        floor: moveTarget.room.floor ?? '—',
                        building: moveTarget.room.building ?? '—',
                      })}
                    </Text>
                  </Box>
                </SimpleGrid>
              </Box>

              {moveLoading && (
                <Text fontSize="sm" color="gray.500">
                  {t('frontOffice.move.searching')}
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
                    <Field label={t('frontOffice.move.type')}>
                      <Select
                        size="sm"
                        value={moveFilters.roomTypeId}
                        onChange={(event) => updateMoveFilter('roomTypeId', event.target.value)}
                      >
                        <option value="">{t('frontOffice.move.all')}</option>
                        {moveRoomTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.name} ({type.capacityAdults}A/{type.capacityChildren}N)
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t('frontOffice.move.floorLabel')}>
                      <Select
                        size="sm"
                        value={moveFilters.floor}
                        onChange={(event) => updateMoveFilter('floor', event.target.value)}
                      >
                        <option value="">{t('frontOffice.move.all')}</option>
                        {moveFloors.map((floor) => (
                          <option key={floor} value={floor}>
                            {floor}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t('frontOffice.move.building')}>
                      <Select
                        size="sm"
                        value={moveFilters.building}
                        onChange={(event) => updateMoveFilter('building', event.target.value)}
                      >
                        <option value="">{t('frontOffice.move.allF')}</option>
                        {moveBuildings.map((building) => (
                          <option key={building} value={building}>
                            {building}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t('frontOffice.move.housekeeping')}>
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
                        <option value="">{t('frontOffice.move.all')}</option>
                        {(['DIRTY', 'CLEANING', 'CLEAN', 'INSPECTED'] as HousekeepingState[]).map(
                          (state) => (
                            <option key={state} value={state}>
                              {housekeepingLabel(locale, state)}
                            </option>
                          ),
                        )}
                      </Select>
                    </Field>
                  </SimpleGrid>
                  <HStack spacing={3} wrap="wrap" align="flex-end" justify="space-between">
                    <Field label={t('frontOffice.move.searchRoom')}>
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
                      onChange={(event) => updateMoveFilter('showIneligible', event.target.checked)}
                    >
                      {t('frontOffice.move.showIneligible')}
                    </Checkbox>
                    <Text fontSize="xs" color="gray.500">
                      {t('frontOffice.move.count', {
                        filtered: filteredMoveCandidates.length,
                        total: moveRooms.length,
                      })}
                    </Text>
                  </HStack>

                  {moveRooms.length === 0 ? (
                    <Text fontSize="sm" color="warning.700">
                      {t('frontOffice.move.noRooms')}
                    </Text>
                  ) : filteredMoveCandidates.length === 0 ? (
                    <Text fontSize="sm" color="warning.700">
                      {t('frontOffice.move.noMatches')}
                    </Text>
                  ) : (
                    <TableContainer
                      maxH="320px"
                      overflowX="auto"
                      overflowY="auto"
                      borderWidth="1px"
                      borderColor="line"
                      borderRadius="md"
                    >
                      <Table size="sm" minW="720px">
                        <Thead>
                          <Tr>
                            <Th>{t('frontOffice.move.tableRoom')}</Th>
                            <Th>{t('frontOffice.move.tableType')}</Th>
                            <Th>{t('frontOffice.move.tableFloor')}</Th>
                            <Th>{t('frontOffice.move.tableHousekeeping')}</Th>
                            <Th>{t('frontOffice.move.tableState')}</Th>
                            <Th
                              position="sticky"
                              right={0}
                              zIndex={1}
                              bg="surface"
                              borderLeftWidth="1px"
                              borderLeftColor="line"
                            >
                              {t('frontOffice.move.tableAction')}
                            </Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {filteredMoveCandidates.map((room) => (
                            <Tr key={room.id} opacity={room.eligible ? 1 : 0.65}>
                              <Td fontWeight="semibold">{room.number}</Td>
                              <Td>
                                <Text fontSize="xs">{room.roomType.name}</Text>
                                <Text fontSize="xs" color="gray.500">
                                  {room.roomType.capacityAdults}A / {room.roomType.capacityChildren}
                                  N
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
                                  label={housekeepingLabel(locale, room.housekeepingState)}
                                />
                              </Td>
                              <Td>
                                <Text fontSize="xs">
                                  {occupancyLabel(locale, room.occupancy)} ·{' '}
                                  {roomOperationalLabel(locale, room.operationalState)}
                                </Text>
                                {room.activeBlock !== null && (
                                  <Text fontSize="xs" color="danger.600">
                                    {t('frontOffice.move.block', {
                                      type: blockTypeLabel(t, room.activeBlock.type),
                                      time: formatDateTime(room.activeBlock.endsAt),
                                    })}
                                  </Text>
                                )}
                                {room.blockers.map((blocker) => (
                                  <Text key={blocker.code} fontSize="xs" color="danger.600">
                                    {roomMoveBlockerLabel(t, blocker.code)}
                                  </Text>
                                ))}
                              </Td>
                              <Td
                                isNumeric
                                position="sticky"
                                right={0}
                                bg="surface"
                                borderLeftWidth="1px"
                                borderLeftColor="line"
                              >
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
                                  {moveRoomId === room.id
                                    ? t('frontOffice.move.chosen')
                                    : t('frontOffice.move.choose')}
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
                        {t('frontOffice.move.compare')}
                      </Text>
                      <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                        <Box>
                          <Text fontSize="xs" color="gray.500">
                            {t('frontOffice.move.actual')}
                          </Text>
                          <Text fontSize="sm">
                            {t('frontOffice.rack.room', {
                              number: moveData.stay.room.number,
                            })}{' '}
                            · {moveData.stay.room.roomType.name}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            {t('frontOffice.move.floor', {
                              floor: moveData.stay.room.floor ?? '—',
                              building: moveData.stay.room.building ?? '—',
                            })}{' '}
                            · {housekeepingLabel(locale, moveData.stay.room.housekeepingState)}
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="gray.500">
                            {t('frontOffice.move.destination')}
                          </Text>
                          <Text fontSize="sm">
                            {t('frontOffice.rack.room', {
                              number: selectedMoveRoom.number,
                            })}{' '}
                            · {selectedMoveRoom.roomType.name}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            {t('frontOffice.move.floor', {
                              floor: selectedMoveRoom.floor ?? '—',
                              building: selectedMoveRoom.building ?? '—',
                            })}{' '}
                            · {housekeepingLabel(locale, selectedMoveRoom.housekeepingState)}
                          </Text>
                        </Box>
                      </SimpleGrid>
                      {selectedMoveRoom.warnings.map((warning) => (
                        <Text key={warning.code} fontSize="xs" color="warning.700" mt={2}>
                          {t('frontOffice.move.housekeepingWarning', {
                            state: housekeepingLabel(
                              locale,
                              selectedMoveRoom.housekeepingState,
                            ).toLowerCase(),
                          })}
                        </Text>
                      ))}
                    </Box>
                  )}

                  <Field
                    label={t('frontOffice.move.reason')}
                    isRequired
                    error={moveErrors['move.reason']}
                    helper={t('frontOffice.move.reasonHelper')}
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
      </ActionDialog>

      <ActionDialog
        isOpen={noShowModal.isOpen}
        onClose={noShowModal.onClose}
        tone="warning"
        title={t('frontOffice.noShow.title')}
        summary={t('frontOffice.noShow.summary')}
        confirmLabel={t('frontOffice.noShow.confirm')}
        onConfirm={() => void handleNoShow()}
        isLoading={busy?.startsWith('no-show') === true}
        hasUnsavedChanges={noShowReason.trim() !== ''}
        error={noShowError === null ? undefined : errorMessage(noShowError)}
      >
        {noShowTarget !== null && (
          <Stack spacing={3}>
            <Text fontSize="sm">
              {noShowTarget.guest.fullName} · {noShowTarget.code} ·{' '}
              {t('frontOffice.noShow.arrival', {
                date: formatCalendarDate(noShowTarget.checkInDate),
              })}
            </Text>
            <Field
              label={t('frontOffice.noShow.reason')}
              helper={t('frontOffice.noShow.reasonHelper')}
            >
              <Textarea
                rows={3}
                value={noShowReason}
                maxLength={500}
                onChange={(event) => setNoShowReason(event.target.value)}
              />
            </Field>
          </Stack>
        )}
      </ActionDialog>

      <Modal isOpen={incidentModal.isOpen} onClose={incidentModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleCreateIncident(event)}>
          <ModalHeader>{t('frontOffice.incidentForm.title')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              {incidentTarget !== null && (
                <Text fontSize="sm">
                  {t('frontOffice.incidentForm.stay', {
                    name: incidentTarget.guest.fullName,
                    number: incidentTarget.room.number,
                  })}
                </Text>
              )}
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <Field label={t('frontOffice.incidentForm.type')}>
                  <Select
                    value={incidentForm.type}
                    onChange={(event) =>
                      setIncidentForm({
                        ...incidentForm,
                        type: event.target.value as IncidentType,
                      })
                    }
                  >
                    {INCIDENT_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {incidentTypeLabel(locale, value)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t('frontOffice.incidentForm.severity')}>
                  <Select
                    value={incidentForm.severity}
                    onChange={(event) =>
                      setIncidentForm({
                        ...incidentForm,
                        severity: event.target.value as IncidentSeverity,
                      })
                    }
                  >
                    {(Object.keys(INCIDENT_SEVERITY_COLORS) as IncidentSeverity[]).map((value) => (
                      <option key={value} value={value}>
                        {incidentSeverityLabel(locale, value)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </SimpleGrid>
              <Field
                label={t('frontOffice.incidentForm.titleField')}
                isRequired
                helper={t('frontOffice.incidentForm.titleHelper')}
              >
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
                label={t('frontOffice.incidentForm.description')}
                isRequired
                helper={t('frontOffice.incidentForm.descriptionHelper')}
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
                  <Field label={t('frontOffice.incidentForm.scope')}>
                    <Select
                      value={incidentForm.scope}
                      onChange={(event) =>
                        setIncidentForm({
                          ...incidentForm,
                          scope: event.target.value as IncidentScope,
                        })
                      }
                    >
                      <option value="none">{t('frontOffice.incidentForm.scopeNone')}</option>
                      <option value="room">{t('frontOffice.incidentForm.scopeRoom')}</option>
                      <option value="stay">{t('frontOffice.incidentForm.scopeStay')}</option>
                    </Select>
                  </Field>
                  {incidentForm.scope === 'room' && (
                    <Field label={t('frontOffice.incidentForm.room')}>
                      <Select
                        value={incidentForm.roomId}
                        onChange={(event) =>
                          setIncidentForm({ ...incidentForm, roomId: event.target.value })
                        }
                      >
                        <option value="">{t('frontOffice.incidentForm.selectPlaceholder')}</option>
                        {data?.roomRack.map((room) => (
                          <option key={room.id} value={room.id}>
                            {t('frontOffice.incidentForm.roomOption', {
                              number: room.number,
                              type: room.roomType.name,
                            })}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  {incidentForm.scope === 'stay' && (
                    <Field label={t('frontOffice.incidentForm.stayField')}>
                      <Select
                        value={incidentForm.stayId}
                        onChange={(event) =>
                          setIncidentForm({ ...incidentForm, stayId: event.target.value })
                        }
                      >
                        <option value="">{t('frontOffice.incidentForm.selectPlaceholder')}</option>
                        {inHouse.map((stay) => (
                          <option key={stay.id} value={stay.id}>
                            {t('frontOffice.incidentForm.stayOption', {
                              number: stay.room.number,
                              name: stay.guest.fullName,
                            })}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                </SimpleGrid>
              )}
              <Divider />
              <Text fontSize="xs" color="gray.500">
                {t('frontOffice.incidentForm.footnote')}
              </Text>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={incidentModal.onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" colorScheme="brand" isLoading={busy === 'incident:create'}>
              {t('frontOffice.incidentForm.register')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ActionDialog
        isOpen={resolveModal.isOpen}
        onClose={resolveModal.onClose}
        tone="info"
        title={t('frontOffice.resolve.title')}
        summary={t('frontOffice.resolve.summary')}
        confirmLabel={t('frontOffice.incidents.resolve')}
        onConfirm={() => void handleResolve()}
        isLoading={busy?.startsWith('incident:resolve') === true}
        confirmDisabled={resolution.trim().length < 3}
        hasUnsavedChanges={resolution.trim() !== ''}
        error={resolveError === null ? undefined : errorMessage(resolveError)}
      >
        {resolveTarget !== null && (
          <Stack spacing={3}>
            <Text fontSize="sm" fontWeight="medium">
              {resolveTarget.title}
            </Text>
            <Text fontSize="xs" color="gray.500">
              {resolveTarget.description}
            </Text>
            <Field
              label={t('frontOffice.resolve.label')}
              isRequired
              helper={t('frontOffice.resolve.helper')}
            >
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
      </ActionDialog>
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
