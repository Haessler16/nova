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
import { ActionDialog } from '@/components/action-dialog';
import { DateField } from '@/components/date-field';
import { ReservationDocuments } from '@/components/documents-panel';
import { ReservationInstructions } from '@/components/instructions-panel';
import { ReservationParty } from '@/components/reservation-party';
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
import { useI18n } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n/dictionary';
import {
  DOCUMENT_TYPES,
  RESERVATION_STATUS_COLORS,
  addDaysISO,
  documentTypeLabel,
  formatCalendarDate,
  formatDateTime,
  nightsBetween,
  reservationStatusLabel,
  todayISO,
} from '@/lib/format';
import { RowActionButton, RowActionLink } from '@/components/ui';
import type {
  Availability,
  AvailabilityItem,
  Guest,
  GuestDocumentType,
  Reservation,
  ReservationHistoryEntry,
  ReservationStatus,
  RoomType,
} from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import {
  buildErrors,
  calendarDateField,
  dateRangeField,
  hasErrors,
  intField,
  optionalText,
  reasonField,
  reservationCodeField,
  validateGuest,
  type FieldErrors,
  type ValidationCopy,
} from '@/lib/validation';

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
  errors,
}: {
  value: GuestFormState;
  onChange: (patch: Partial<GuestFormState>) => void;
  disabled?: boolean;
  idPrefix: string;
  errors?: FieldErrors;
}) {
  const { t, locale } = useI18n();
  return (
    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
      <Field label={t('reservations.guest.field.fullName')} isRequired error={errors?.fullName}>
        <Input
          id={`${idPrefix}-full-name`}
          value={value.fullName}
          onChange={(event) => onChange({ fullName: event.target.value })}
          placeholder={t('reservations.guest.field.fullNamePlaceholder')}
          isDisabled={disabled}
          maxLength={160}
        />
      </Field>
      <Field label={t('reservations.guest.field.email')} error={errors?.email}>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          value={value.email}
          onChange={(event) => onChange({ email: event.target.value })}
          placeholder={t('reservations.guest.field.emailPlaceholder')}
          isDisabled={disabled}
          maxLength={254}
        />
      </Field>
      <Field label={t('reservations.guest.field.phone')} error={errors?.phone}>
        <Input
          id={`${idPrefix}-phone`}
          value={value.phone}
          onChange={(event) => onChange({ phone: event.target.value })}
          placeholder="+55 11 90000-0000"
          isDisabled={disabled}
          maxLength={32}
        />
      </Field>
      <Field label={t('reservations.guest.field.documentType')}>
        <Select
          id={`${idPrefix}-document-type`}
          value={value.documentType}
          onChange={(event) =>
            onChange({ documentType: event.target.value as '' | GuestDocumentType })
          }
          isDisabled={disabled}
        >
          <option value="">{t('reservations.guest.noDocument')}</option>
          {DOCUMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {documentTypeLabel(locale, type)}
            </option>
          ))}
        </Select>
      </Field>
      {value.documentType !== '' && (
        <Field
          label={t('reservations.guest.field.documentNumber')}
          isRequired
          error={errors?.documentNumber}
        >
          <Input
            id={`${idPrefix}-document-number`}
            value={value.documentNumber}
            onChange={(event) => onChange({ documentNumber: event.target.value })}
            placeholder={t('reservations.guest.field.documentNumberPlaceholder')}
            isDisabled={disabled}
            minLength={3}
            maxLength={64}
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
  const { t } = useI18n();
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
          {t('reservations.unassigned')}
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
          {t('reservations.roomPrefix', { number: item.number })}
          {item.floor !== null ? t('reservations.floor', { floor: item.floor }) : ''}
        </Button>
      ))}
    </HStack>
  );
}

type Translator = ReturnType<typeof useI18n>['t'];

/**
 * Validation templates for this screen. `lib/validation` keeps the historical
 * Spanish text as its default, so passing this object is what localizes the
 * messages instead of duplicating the rules here.
 */
function validationCopy(t: Translator): ValidationCopy {
  return {
    required: (label) => t('validation.required', { label }),
    maxLength: (label, max) => t('validation.maxLength', { label, max }),
    integer: (label) => t('validation.integer', { label }),
    range: (label, min, max) => t('validation.range', { label, min, max }),
    minLength: (label, min) => t('validation.minLength', { label, min }),
    date: (label) => t('validation.date', { label }),
    dateOrder: t('validation.dateOrder'),
    nights: (max) => t('validation.nights', { max }),
    code: t('validation.code'),
    emailRequired: t('validation.emailRequired'),
    emailInvalid: t('validation.emailInvalid'),
    phoneInvalid: t('validation.phoneInvalid'),
  };
}

function guestFieldLabels(t: Translator) {
  return {
    fullName: t('validation.label.guestName'),
    documentNumber: t('validation.label.guestDocumentNumber'),
    notes: t('validation.label.notes'),
  };
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const ACTION_LABEL_KEYS: Record<string, TranslationKey> = {
  'reservation.created': 'reservations.action.created',
  'reservation.updated': 'reservations.action.updated',
  'reservation.room_assigned': 'reservations.action.roomAssigned',
  'reservation.room_reassigned': 'reservations.action.roomReassigned',
  'reservation.room_unassigned': 'reservations.action.roomUnassigned',
  'reservation.cancelled': 'reservations.action.cancelled',
  'reservation.status_changed': 'reservations.action.statusChanged',
  'reservation.checked_in': 'reservations.action.checkedIn',
  'reservation.checked_out': 'reservations.action.checkedOut',
  'reservation.room_moved': 'reservations.action.roomMoved',
  'reservation.no_show': 'reservations.action.noShow',
};

function actionLabel(t: Translator, action: string): string {
  const key = ACTION_LABEL_KEYS[action];
  return key === undefined ? action : t(key);
}

function adultsLabel(t: Translator, count: number): string {
  return count === 1
    ? t('reservations.adultsOne', { count })
    : t('reservations.adultsOther', { count });
}

function childrenLabel(t: Translator, count: number): string {
  return count === 1
    ? t('reservations.childrenOne', { count })
    : t('reservations.childrenOther', { count });
}

function ReservationsContent() {
  const { tenant, property } = useSession();
  const propertyTimezone = property?.timezone;
  const toast = useToast();
  const { t, locale } = useI18n();
  const copy = validationCopy(t);
  const cancelConfirmation = useDisclosure();
  const [cancelApiError, setCancelApiError] = useState<string | null>(null);

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
  const drawer = useDisclosure();
  const [detailVersion, bumpDetail] = useReducer((value: number) => value + 1, 0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const [saving, setSaving] = useState(false);
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [cancelErrors, setCancelErrors] = useState<FieldErrors>({});
  const [createGuestErrors, setCreateGuestErrors] = useState<FieldErrors>({});
  const [editGuestErrors, setEditGuestErrors] = useState<FieldErrors>({});

  const [createForm, setCreateForm] = useState({
    checkInDate: todayISO(0, propertyTimezone),
    checkOutDate: todayISO(1, propertyTimezone),
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

  function openCreate(): void {
    setCreateForm({
      checkInDate: todayISO(0, propertyTimezone),
      checkOutDate: todayISO(1, propertyTimezone),
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
    setCreateErrors({});
    setCreateGuestErrors({});
    createModal.onOpen();
  }

  const openedFromQuery = useRef(false);
  const openCreateRef = useRef(openCreate);
  openCreateRef.current = openCreate;
  const openDetailRef = useRef(openDetail);
  openDetailRef.current = openDetail;
  useEffect(() => {
    if (openedFromQuery.current) {
      return;
    }
    openedFromQuery.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') {
      openCreateRef.current();
    }
    const search = params.get('search');
    if (search !== null && search.trim() !== '') {
      setSearchInput(search.trim());
      setFilters((current) => ({ ...current, search: search.trim() }));
    }
    // Deep link from Front Desk search results: open the reservation drawer.
    const reservationParam = params.get('reservation');
    if (reservationParam !== null) {
      void api<Reservation>(`/api/v1/reservations/${reservationParam}`, { tenant })
        .then((reservation) => openDetailRef.current(reservation))
        .catch(() => {
          // The list stays usable if the deep link is stale or unauthorized.
        });
    }
  }, [tenant]);

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
    setEditErrors({});
    editModal.onOpen();
  }

  async function handleCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    const nextErrors = buildErrors([
      [
        'checkInDate',
        calendarDateField(createForm.checkInDate, t('validation.label.checkIn'), copy),
      ],
      [
        'checkOutDate',
        calendarDateField(createForm.checkOutDate, t('validation.label.checkOut'), copy),
      ],
      ['dates', dateRangeField(createForm.checkInDate, createForm.checkOutDate, { copy })],
      [
        'adults',
        intField(createForm.adults, t('validation.label.adults'), { min: 1, max: 20 }, copy),
      ],
      [
        'children',
        intField(createForm.children, t('validation.label.children'), { min: 0, max: 20 }, copy),
      ],
      ['guestId', createForm.guestId === '' ? t('validation.guestRequired') : null],
      ['roomTypeId', createForm.roomTypeId === '' ? t('validation.roomTypeRequired') : null],
      ['code', reservationCodeField(createForm.code, copy)],
      ['source', optionalText(createForm.source, t('validation.label.source'), { max: 32 }, copy)],
      [
        'notes',
        optionalText(createForm.notes, t('validation.label.observation'), { max: 2000 }, copy),
      ],
    ]);
    setCreateErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    try {
      const created = await api<Reservation>('/api/v1/reservations', {
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
      toast({ title: t('reservations.toast.created'), status: 'success' });
      createModal.onClose();
      reload();

      // The structured panel lives in the detail. If the operator pasted an
      // observation at creation time, pre-parse it so suggestions are ready for
      // human confirmation; the parser never changes money or occupancy.
      if (createForm.notes.trim() !== '') {
        try {
          await api(`/api/v1/reservations/${created.id}/source-notes/parse`, {
            method: 'POST',
            tenant,
            body: { text: createForm.notes.trim(), sourceSystem: 'RESERVATIONS_FORM' },
          });
          toast({
            title: t('reservations.toast.parsed'),
            description: t('reservations.toast.parsedBody'),
            status: 'info',
            duration: 8000,
          });
        } catch {
          toast({
            title: t('reservations.toast.parseFailed'),
            description: t('reservations.toast.parseFailedBody'),
            status: 'warning',
            duration: 8000,
          });
        }
      }
      openDetail(created);
    } catch (cause) {
      toast({
        title: t('reservations.toast.createError'),
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
    const nextErrors = buildErrors([
      ['checkInDate', calendarDateField(editForm.checkInDate, t('validation.label.checkIn'), copy)],
      [
        'checkOutDate',
        calendarDateField(editForm.checkOutDate, t('validation.label.checkOut'), copy),
      ],
      ['dates', dateRangeField(editForm.checkInDate, editForm.checkOutDate, { copy })],
      [
        'adults',
        intField(editForm.adults, t('validation.label.adults'), { min: 1, max: 20 }, copy),
      ],
      [
        'children',
        intField(editForm.children, t('validation.label.children'), { min: 0, max: 20 }, copy),
      ],
      ['notes', optionalText(editForm.notes, t('validation.label.notes'), { max: 2000 }, copy)],
    ]);
    setEditErrors(nextErrors);
    if (hasErrors(nextErrors)) {
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
      toast({ title: t('reservations.toast.updated'), status: 'success' });
      editModal.onClose();
      reload();
      bumpDetail();
    } catch (cause) {
      toast({
        title: t('reservations.toast.updateError'),
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
      toast({ title: t('reservations.toast.assigned'), status: 'success' });
      setAssignRoomId('');
      reload();
      bumpDetail();
    } catch (cause) {
      toast({
        title: t('reservations.toast.assignError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(): Promise<void> {
    if (selectedId === null) {
      return;
    }
    const reason = cancelReason.trim();
    const nextErrors = buildErrors([
      [
        'reason',
        reason === '' ? null : reasonField(reason, t('validation.label.cancelReason'), {}, copy),
      ],
    ]);
    setCancelErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    setCancelApiError(null);
    try {
      await api<Reservation>(`/api/v1/reservations/${selectedId}/cancel`, {
        method: 'POST',
      });
      toast({ title: t('reservations.toast.cancelled'), status: 'success' });
      cancelConfirmation.onClose();
      setCancelReason('');

      reload();
      bumpDetail();
    } catch (cause) {
      const message = errorMessage(cause);
      setCancelApiError(message);
      toast({
        title: t('reservations.toast.cancelError'),
        description: message,
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
    const nextErrors = validateGuest(guestForm, { copy, labels: guestFieldLabels(t) });
    setCreateGuestErrors(nextErrors);
    if (hasErrors(nextErrors)) {
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
      toast({ title: t('reservations.toast.guestCreated'), status: 'success' });
    } catch (cause) {
      toast({
        title: t('reservations.toast.guestCreateError'),
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
    setEditGuestErrors({});
    guestEditModal.onOpen();
  }

  async function handleGuestEdit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (guestEditTarget === null) {
      return;
    }
    const nextErrors = validateGuest(guestEditForm, { copy, labels: guestFieldLabels(t) });
    setEditGuestErrors(nextErrors);
    if (hasErrors(nextErrors)) {
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
      toast({ title: t('reservations.toast.guestUpdated'), status: 'success' });
      guestEditModal.onClose();
      if (guestEditSource === 'detail') {
        bumpDetail();
      }
      reload();
    } catch (cause) {
      toast({
        title: t('reservations.toast.guestUpdateError'),
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
      toast({ title: t('reservations.toast.checkIn'), status: 'success' });
      reload();
      bumpDetail();
    } catch (cause) {
      toast({
        title: t('reservations.toast.checkInError'),
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
        `reservas-${todayISO(0, propertyTimezone)}.csv`,
      );
      toast({ title: t('reservations.toast.exported'), status: 'success' });
    } catch (cause) {
      toast({
        title: t('reservations.toast.exportError'),
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
        title={t('reservations.title')}
        description={t('reservations.description')}
        actions={
          <HStack spacing={2}>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<DownloadIcon boxSize={4} />}
              onClick={() => void exportReservations()}
              isLoading={exporting}
            >
              {t('reservations.export')}
            </Button>
            <Button colorScheme="brand" size="sm" onClick={openCreate}>
              {t('reservations.new')}
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
                  placeholder={t('reservations.searchPlaceholder')}
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
                <Button size="sm" type="submit" variant="outline">
                  {t('reservations.search')}
                </Button>
              </HStack>
            </form>
            <Select
              size="sm"
              width="170px"
              aria-label={t('reservations.filter.status')}
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            >
              <option value="">{t('reservations.filter.allStatuses')}</option>
              {(Object.keys(RESERVATION_STATUS_COLORS) as ReservationStatus[]).map((value) => (
                <option key={value} value={value}>
                  {reservationStatusLabel(locale, value)}
                </option>
              ))}
            </Select>
            <HStack spacing={1}>
              <Text fontSize="xs" color="textSecondary">
                {t('reservations.filter.from')}
              </Text>
              <DateField
                size="sm"
                width="150px"
                value={filters.fromDate}
                placeholder="dd/mm/aaaa"
                ariaLabel={t('reservations.filter.fromAria')}
                isClearable
                onChange={(fromDate) =>
                  setFilters({
                    ...filters,
                    fromDate,
                    ...(filters.toDate !== '' && filters.toDate <= fromDate ? { toDate: '' } : {}),
                  })
                }
              />
              <Text fontSize="xs" color="textSecondary">
                {t('reservations.filter.to')}
              </Text>
              <DateField
                size="sm"
                width="150px"
                value={filters.toDate}
                min={filters.fromDate !== '' ? filters.fromDate : undefined}
                placeholder="dd/mm/aaaa"
                ariaLabel={t('reservations.filter.toAria')}
                isClearable
                onChange={(toDate) => setFilters({ ...filters, toDate })}
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
              {t('reservations.filter.clear')}
            </Button>
          </HStack>
          <Text fontSize="xs" color="textSecondary">
            {(data?.items.length ?? 0) === 1
              ? t('reservations.countOne', { count: data?.items.length ?? 0 })
              : t('reservations.countOther', { count: data?.items.length ?? 0 })}
            {data?.nextCursor != null ? ` ${t('reservations.moreResults')}` : ''}
          </Text>
        </Stack>

        <QueryFeedback
          loading={loading}
          error={error}
          onRetry={reload}
          isEmpty={(data?.items.length ?? 0) === 0}
          emptyText={t('reservations.empty')}
        >
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>{t('reservations.column.code')}</Th>
                  <Th>{t('reservations.column.guest')}</Th>
                  <Th>{t('reservations.column.stay')}</Th>
                  <Th>{t('reservations.column.room')}</Th>
                  <Th>{t('reservations.column.status')}</Th>
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
                      <Text fontSize="xs" color="textSecondary">
                        {reservation.source ?? t('reservations.row.direct')}
                      </Text>
                    </Td>
                    <Td>
                      <Text fontWeight="medium">{reservation.guest.fullName}</Text>
                      <Text fontSize="xs" color="textSecondary">
                        {reservation.guest.email ??
                          reservation.guest.phone ??
                          t('reservations.row.noContact')}
                      </Text>
                    </Td>
                    <Td>
                      <Text fontSize="sm">
                        {formatCalendarDate(reservation.checkInDate)} →{' '}
                        {formatCalendarDate(reservation.checkOutDate)}
                      </Text>
                      <Text fontSize="xs" color="textSecondary">
                        {reservation.nights === 1
                          ? t('reservations.nightsOne', { count: reservation.nights })
                          : t('reservations.nightsOther', { count: reservation.nights })}{' '}
                        · {adultsLabel(t, reservation.adults)}
                        {reservation.children > 0
                          ? ` · ${childrenLabel(t, reservation.children)}`
                          : ''}
                      </Text>
                    </Td>
                    <Td>
                      <Text fontSize="sm">{reservation.roomType.name}</Text>
                      <Text fontSize="xs" color="textSecondary">
                        {reservation.room !== null
                          ? t('reservations.roomPrefix', { number: reservation.room.number })
                          : t('reservations.unassigned')}
                      </Text>
                    </Td>
                    <Td>
                      <StatusBadge
                        color={RESERVATION_STATUS_COLORS[reservation.status]}
                        label={reservationStatusLabel(locale, reservation.status)}
                      />
                    </Td>
                    <Td>
                      <HStack spacing={1} justify="flex-end" wrap="nowrap">
                        <RowActionLink
                          href={`/reservations?reservation=${reservation.id}`}
                          label={t('reservations.row.open', { code: reservation.code })}
                          onClick={() => openDetail(reservation)}
                        >
                          {t('reservations.row.detail')}
                        </RowActionLink>
                        {reservation.status === 'CONFIRMED' && (
                          <>
                            <RowActionButton onClick={() => openEdit(reservation)}>
                              {t('reservations.row.edit')}
                            </RowActionButton>
                            <RowActionButton
                              onClick={() => {
                                setSelectedId(reservation.id);
                                setCancelReason('');
                                setCancelErrors({});
                                cancelConfirmation.onOpen();
                              }}
                              colorScheme="danger"
                            >
                              {t('reservations.row.cancel')}
                            </RowActionButton>
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
          <ModalHeader>{t('reservations.new')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody py={4}>
            <Stack spacing={4}>
              <Box>
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="semibold">{t('reservations.section.guest')}</Text>
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
                      {t('reservations.guest.new')}
                    </Button>
                  )}
                </HStack>

                {createErrors.guestId !== undefined && (
                  <Text fontSize="xs" color="danger.500" mb={2}>
                    {createErrors.guestId}
                  </Text>
                )}

                {selectedGuest !== null ? (
                  <Box borderWidth="1px" borderColor="line" borderRadius="md" p={3} bg="gray.50">
                    <HStack justify="space-between" align="flex-start" wrap="wrap" spacing={3}>
                      <Box minW={0}>
                        <Text fontWeight="semibold">{selectedGuest.fullName}</Text>
                        <Text fontSize="xs" color="textSecondary" isTruncated>
                          {[selectedGuest.email, selectedGuest.phone].filter(Boolean).join(' · ') ||
                            t('reservations.guest.noContact')}
                        </Text>
                        <Text fontSize="xs" color="textSecondary">
                          {selectedGuest.documentType !== null
                            ? `${documentTypeLabel(locale, selectedGuest.documentType)} ${selectedGuest.documentNumber ?? ''}`
                            : t('reservations.guest.noDocument')}
                        </Text>
                      </Box>
                      <HStack spacing={2}>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => openGuestEdit(selectedGuest, 'create')}
                        >
                          {t('reservations.guest.editData')}
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
                          {t('reservations.guest.change')}
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
                      errors={createGuestErrors}
                    />
                    <HStack justify="flex-end" mt={3}>
                      <Button size="sm" variant="ghost" onClick={() => setGuestPanel('none')}>
                        {t('common.cancel')}
                      </Button>
                      <Button
                        size="sm"
                        colorScheme="brand"
                        onClick={() => void handleCreateGuest()}
                        isLoading={guestSaving}
                      >
                        {t('reservations.guest.createAndSelect')}
                      </Button>
                    </HStack>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    <Input
                      aria-label={t('reservations.guest.searchAria')}
                      placeholder={t('reservations.guest.searchPlaceholder')}
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
                        <Text px={3} py={2} fontSize="sm" color="textSecondary">
                          {t('reservations.guest.searching')}
                        </Text>
                      ) : (guestLookup.data?.items.length ?? 0) === 0 ? (
                        <Text px={3} py={2} fontSize="sm" color="textSecondary">
                          {debouncedGuestSearch === ''
                            ? t('reservations.guest.noneActive')
                            : t('reservations.guest.noneActiveFor', {
                                term: debouncedGuestSearch,
                              })}
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
                                <Text fontSize="xs" color="textSecondary" isTruncated>
                                  {[guest.email, guest.phone].filter(Boolean).join(' · ') ||
                                    t('reservations.guest.noContact')}
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
                      {guestSearch.trim() === ''
                        ? t('reservations.guest.createNew')
                        : t('reservations.guest.createNewFor', { term: guestSearch.trim() })}
                    </Button>
                  </Stack>
                )}
              </Box>

              <Box>
                <Text fontWeight="semibold" mb={2}>
                  {t('reservations.section.stay')}
                </Text>
                <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                  <Field
                    label={t('reservations.field.checkIn')}
                    isRequired
                    error={createErrors.checkInDate}
                  >
                    <DateField
                      value={createForm.checkInDate}
                      min={todayISO(0, propertyTimezone)}
                      placeholder="dd/mm/aaaa"
                      ariaLabel={t('reservations.field.checkInAria')}
                      onChange={(checkInDate) =>
                        setCreateForm({
                          ...createForm,
                          checkInDate,
                          checkOutDate:
                            createForm.checkOutDate <= checkInDate
                              ? addDaysISO(checkInDate, 1)
                              : createForm.checkOutDate,
                          roomId: '',
                        })
                      }
                    />
                  </Field>
                  <Field
                    label={t('reservations.field.checkOut')}
                    isRequired
                    error={createErrors.checkOutDate}
                  >
                    <DateField
                      value={createForm.checkOutDate}
                      min={createForm.checkInDate}
                      placeholder="dd/mm/aaaa"
                      ariaLabel={t('reservations.field.checkOutAria')}
                      onChange={(checkOutDate) =>
                        setCreateForm({
                          ...createForm,
                          checkOutDate,
                          roomId: '',
                        })
                      }
                    />
                  </Field>
                  <Field
                    label={t('reservations.field.adults')}
                    isRequired
                    error={createErrors.adults}
                  >
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
                  <Field label={t('reservations.field.children')} error={createErrors.children}>
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
                <Text
                  mt={2}
                  fontSize="xs"
                  color={createDatesValid ? 'textSecondary' : 'danger.500'}
                >
                  {createDatesValid
                    ? createNights === 1
                      ? t('reservations.stay.summaryOne', { count: createNights })
                      : t('reservations.stay.summaryOther', { count: createNights })
                    : t('reservations.stay.invalidRange')}
                </Text>
              </Box>

              <Box>
                <Text fontWeight="semibold" mb={2}>
                  {t('reservations.section.room')}
                </Text>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  <Field
                    label={t('reservations.field.roomType')}
                    isRequired
                    error={createErrors.roomTypeId}
                  >
                    <Select
                      value={createForm.roomTypeId}
                      onChange={(event) =>
                        setCreateForm({ ...createForm, roomTypeId: event.target.value, roomId: '' })
                      }
                      required
                    >
                      <option value="">{t('reservations.room.selectPlaceholder')}</option>
                      {lookup.data?.roomTypes.map((roomType) => (
                        <option key={roomType.id} value={roomType.id}>
                          {t('reservations.room.typeOption', {
                            name: roomType.name,
                            capacity: roomType.capacityAdults,
                          })}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Box alignSelf="end">
                    <Text fontSize="xs" color="textSecondary">
                      {createForm.roomTypeId === ''
                        ? t('reservations.room.chooseType')
                        : t('reservations.room.assignLater')}
                    </Text>
                  </Box>
                </SimpleGrid>

                {createForm.roomTypeId !== '' && createDatesValid && (
                  <Box mt={3}>
                    {availability.loading ? (
                      <Text fontSize="sm" color="textSecondary">
                        {t('reservations.room.checking')}
                      </Text>
                    ) : availability.error !== null ? (
                      <Text fontSize="sm" color="danger.500">
                        {errorMessage(availability.error)}
                      </Text>
                    ) : (availability.data?.items.length ?? 0) === 0 ? (
                      <Text fontSize="sm" color="warning.600">
                        {t('reservations.room.noneForRange')}
                      </Text>
                    ) : (
                      <Box>
                        <Text fontSize="xs" color="textSecondary" mb={2}>
                          {availability.data?.items.length === 1
                            ? t('reservations.room.availableOne')
                            : t('reservations.room.availableOther')}
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
                  {showDetails ? t('reservations.optional.hide') : t('reservations.optional.show')}
                </Button>
                <Collapse in={showDetails} animateOpacity>
                  <Box pt={3}>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                      <Field
                        label={t('reservations.field.code')}
                        error={createErrors.code}
                        helper={t('reservations.field.codeHelper')}
                      >
                        <Input
                          value={createForm.code}
                          aria-label={t('reservations.field.codeAria')}
                          maxLength={32}
                          onChange={(event) =>
                            setCreateForm({ ...createForm, code: event.target.value })
                          }
                        />
                      </Field>
                      <Field label={t('reservations.field.source')} error={createErrors.source}>
                        <Input
                          value={createForm.source}
                          placeholder={t('reservations.field.sourcePlaceholder')}
                          maxLength={32}
                          onChange={(event) =>
                            setCreateForm({ ...createForm, source: event.target.value })
                          }
                        />
                      </Field>
                    </SimpleGrid>
                    <Field
                      label={t('reservations.field.observation')}
                      error={createErrors.notes}
                      helper={t('reservations.field.observationHelper')}
                    >
                      <Textarea
                        mt={3}
                        rows={3}
                        maxLength={2000}
                        value={createForm.notes}
                        placeholder="Ej.: RSV COM CAFE / PGTO DIRETO NO HOTEL (12-15/11) / LUXO CASAL"
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
              {t('common.cancel')}
            </Button>
            <Button type="submit" colorScheme="brand" isLoading={saving}>
              {t('reservations.create.submit')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit */}
      <Modal isOpen={editModal.isOpen} onClose={editModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleEdit(event)}>
          <ModalHeader>{t('reservations.edit.title')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <SimpleGrid columns={2} spacing={4}>
                <Field
                  label={t('reservations.field.checkIn')}
                  isRequired
                  error={editErrors.checkInDate}
                >
                  <DateField
                    value={editForm.checkInDate}
                    placeholder="dd/mm/aaaa"
                    ariaLabel={t('reservations.field.checkInAria')}
                    onChange={(checkInDate) => setEditForm({ ...editForm, checkInDate })}
                  />
                </Field>
                <Field
                  label={t('reservations.field.checkOut')}
                  isRequired
                  error={editErrors.checkOutDate}
                >
                  <DateField
                    value={editForm.checkOutDate}
                    min={editForm.checkInDate !== '' ? editForm.checkInDate : undefined}
                    placeholder="dd/mm/aaaa"
                    ariaLabel={t('reservations.field.checkOutAria')}
                    onChange={(checkOutDate) => setEditForm({ ...editForm, checkOutDate })}
                  />
                </Field>
              </SimpleGrid>
              {editErrors.dates !== undefined && (
                <Text fontSize="xs" color="danger.500">
                  {editErrors.dates}
                </Text>
              )}
              <SimpleGrid columns={2} spacing={4}>
                <Field label={t('reservations.field.adults')} isRequired error={editErrors.adults}>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={editForm.adults}
                    onChange={(event) => setEditForm({ ...editForm, adults: event.target.value })}
                    required
                  />
                </Field>
                <Field label={t('reservations.field.children')} error={editErrors.children}>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={editForm.children}
                    onChange={(event) => setEditForm({ ...editForm, children: event.target.value })}
                  />
                </Field>
              </SimpleGrid>
              <Field
                label={t('reservations.field.notes')}
                error={editErrors.notes}
                helper={t('reservations.field.notesHelper')}
              >
                <Textarea
                  rows={3}
                  maxLength={2000}
                  value={editForm.notes}
                  onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })}
                />
              </Field>
              <Text fontSize="xs" color="textSecondary">
                {t('reservations.edit.warning')}
              </Text>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={editModal.onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" colorScheme="brand" isLoading={saving}>
              {t('common.save')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Cancel */}
      <ActionDialog
        isOpen={cancelConfirmation.isOpen}
        onClose={() => {
          cancelConfirmation.onClose();
          setCancelApiError(null);
        }}
        tone={selectedReservation?.status === 'CHECKED_IN' ? 'critical' : 'warning'}
        title={t('reservations.cancel.title')}
        summary={
          selectedReservation === null
            ? t('reservations.cancel.summaryEmpty')
            : (selectedReservation.checkInDate <= today && selectedReservation.checkOutDate > today
                ? t('reservations.cancel.summaryActive', {
                    roomType: selectedReservation.roomType.name,
                    code: selectedReservation.code,
                  })
                : t('reservations.cancel.summaryFuture', {
                    roomType: selectedReservation.roomType.name,
                    code: selectedReservation.code,
                  })) +
              (selectedReservation.room !== null
                ? ` ${t('reservations.cancel.summaryRoom', {
                    number: selectedReservation.room.number,
                  })}`
                : '')
        }
        confirmLabel={t('reservations.cancel.title')}
        hasUnsavedChanges={cancelReason.trim().length > 0}
        isLoading={saving}
        error={cancelApiError ?? undefined}
        onConfirm={() => void handleCancel()}
      >
        <Stack spacing={3}>
          <Box>
            <Text fontSize="xs" color="textSecondary" textTransform="uppercase" mb={1}>
              {t('reservations.cancel.reasonLabel')}
            </Text>
            <Textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder={t('reservations.cancel.reasonPlaceholder')}
              maxLength={500}
              rows={3}
            />
            {cancelErrors.reason !== undefined && (
              <Text fontSize="xs" color="danger.500" mt={1}>
                {cancelErrors.reason}
              </Text>
            )}
          </Box>
          <Text fontSize="xs" color="textSecondary">
            {t('reservations.cancel.irreversible')}
          </Text>
        </Stack>
      </ActionDialog>

      {/* Edit guest data from the reservation flow */}
      <Modal isOpen={guestEditModal.isOpen} onClose={guestEditModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void handleGuestEdit(event)}>
          <ModalHeader>{t('reservations.guestEdit.title')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Text fontSize="sm" color="textSecondary">
                {t('reservations.guestEdit.body')}
              </Text>
              <GuestFields
                value={guestEditForm}
                onChange={(patch) => setGuestEditForm((current) => ({ ...current, ...patch }))}
                disabled={guestSaving}
                idPrefix="edit-reservation-guest"
                errors={editGuestErrors}
              />
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={guestEditModal.onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" colorScheme="brand" isLoading={guestSaving}>
              {t('reservations.guestEdit.submit')}
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
            {t('reservations.detail.title', { code: selectedReservation?.code ?? '' })}
            {selectedReservation !== null && (
              <Text fontSize="sm" fontWeight="normal" color="textSecondary">
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
              emptyText={t('reservations.detail.empty')}
            >
              {selectedReservation !== null && (
                <Stack spacing={5}>
                  <HStack justify="space-between" align="start">
                    <HStack wrap="wrap">
                      <StatusBadge
                        color={RESERVATION_STATUS_COLORS[selectedReservation.status]}
                        label={reservationStatusLabel(locale, selectedReservation.status)}
                      />
                      {selectedReservation.source !== null && (
                        <Badge colorScheme="gray">{selectedReservation.source}</Badge>
                      )}
                    </HStack>
                    <ReservationDocuments
                      reservationId={selectedReservation.id}
                      reservationCode={selectedReservation.code}
                    />
                  </HStack>

                  <SimpleGrid columns={2} spacing={3}>
                    <KeyValue
                      label={t('reservations.field.checkIn')}
                      value={formatCalendarDate(selectedReservation.checkInDate)}
                    />
                    <KeyValue
                      label={t('reservations.field.checkOut')}
                      value={formatCalendarDate(selectedReservation.checkOutDate)}
                    />
                    <KeyValue
                      label={t('reservations.detail.nights')}
                      value={selectedReservation.nights}
                    />
                    <KeyValue
                      label={t('reservations.detail.occupancy')}
                      value={t('reservations.detail.occupancyValue', {
                        adults: adultsLabel(t, selectedReservation.adults),
                        children: childrenLabel(t, selectedReservation.children),
                      })}
                    />
                    <KeyValue
                      label={t('reservations.detail.type')}
                      value={selectedReservation.roomType.name}
                    />
                    <KeyValue
                      label={t('reservations.detail.room')}
                      value={
                        selectedReservation.room !== null
                          ? t('reservations.roomPrefix', {
                              number: selectedReservation.room.number,
                            })
                          : t('reservations.unassigned')
                      }
                    />
                    <KeyValue
                      label={t('reservations.detail.guest')}
                      value={selectedReservation.guest.fullName}
                    />
                    <KeyValue
                      label={t('reservations.detail.contact')}
                      value={
                        selectedReservation.guest.email ?? selectedReservation.guest.phone ?? '—'
                      }
                    />
                    <KeyValue
                      label={t('reservations.detail.document')}
                      value={
                        detailGuest?.documentType != null
                          ? `${documentTypeLabel(locale, detailGuest.documentType)} ${detailGuest.documentNumber ?? ''}`
                          : t('reservations.guest.noDocument')
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
                      {t('reservations.guestEdit.title')}
                    </Button>
                  )}

                  <ReservationParty
                    reservationId={selectedReservation.id}
                    checkInDate={selectedReservation.checkInDate}
                    editable={selectedReservation.status === 'CONFIRMED'}
                    onChanged={bumpDetail}
                  />

                  <ReservationInstructions
                    reservationId={selectedReservation.id}
                    canManage={
                      selectedReservation.status !== 'CANCELLED' &&
                      selectedReservation.status !== 'CHECKED_OUT'
                    }
                    onChanged={bumpDetail}
                  />

                  {selectedReservation.notes !== null && (
                    <Box>
                      <Text fontSize="xs" color="textSecondary" textTransform="uppercase">
                        {t('reservations.detail.notes')}
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
                          {t('reservations.section.room')}
                        </Text>
                        {detailAvailability.loading ? (
                          <Text fontSize="sm" color="textSecondary">
                            {t('reservations.room.checking')}
                          </Text>
                        ) : detailAvailability.error !== null ? (
                          <Text fontSize="sm" color="danger.500">
                            {errorMessage(detailAvailability.error)}
                          </Text>
                        ) : (detailAvailability.data?.items.length ?? 0) === 0 ? (
                          <Text fontSize="sm" color="warning.600">
                            {t('reservations.room.noneForDates')}
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
                            {t('reservations.room.assign')}
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
                            {t('reservations.room.checkIn')}
                          </Button>
                        </HStack>
                        {selectedReservation.room === null && (
                          <Text fontSize="xs" color="textSecondary" mt={2}>
                            {t('reservations.room.assignToEnable')}
                          </Text>
                        )}
                        {selectedReservation.room !== null && !checkInEligible && (
                          <Text fontSize="xs" color="textSecondary" mt={2}>
                            {t('reservations.room.checkInFromArrival')}
                          </Text>
                        )}
                      </Box>
                    </>
                  )}

                  {selectedReservation.cancellationReason !== null && (
                    <Box>
                      <Text fontSize="xs" color="textSecondary" textTransform="uppercase">
                        {t('reservations.detail.cancelReason')}
                      </Text>
                      <Text fontSize="sm">{selectedReservation.cancellationReason}</Text>
                      <Text fontSize="xs" color="textSecondary">
                        {formatDateTime(selectedReservation.cancelledAt)}
                      </Text>
                    </Box>
                  )}

                  <Divider />
                  <Box>
                    <Text fontWeight="semibold" mb={2}>
                      {t('reservations.detail.history')}
                    </Text>
                    <QueryFeedback
                      loading={false}
                      error={null}
                      isEmpty={detail.data?.history.length === 0}
                      emptyText={t('reservations.detail.historyEmpty')}
                    >
                      <Stack spacing={2} maxH="320px" overflowY="auto">
                        {detail.data?.history.map((entry) => (
                          <Box key={entry.id} borderLeftWidth="3px" borderColor="brand.200" pl={3}>
                            <Text fontSize="sm" fontWeight="medium">
                              {actionLabel(t, entry.action)}
                            </Text>
                            <Text fontSize="xs" color="textSecondary">
                              {formatDateTime(entry.occurredAt)}
                              {entry.toStatus !== null
                                ? ` · ${reservationStatusLabel(locale, entry.toStatus)}`
                                : ''}
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
