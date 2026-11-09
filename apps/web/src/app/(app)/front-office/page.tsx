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
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { PropertyGate } from '@/components/app-shell';
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
} from '@/lib/format';
import type {
  FrontOfficeOverview,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  Reservation,
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

function StayCard({
  stay,
  busy,
  onCheckOut,
  onMove,
  onIncident,
}: {
  stay: Stay;
  busy: string | null;
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
          </Text>
        </Box>
        <StatusBadge color="mint" label="En casa" />
      </HStack>
      <HStack spacing={1} mt={2} wrap="wrap">
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
        <Button as={NextLink} href="/reservations" size="xs" variant="ghost">
          Reserva
        </Button>
      </HStack>
    </Box>
  );
}

function FrontOfficeContent() {
  const { tenant } = useSession();
  const toast = useToast();

  const [incidentFilter, setIncidentFilter] = useState<IncidentStatus | ''>('OPEN');
  const [busy, setBusy] = useState<string | null>(null);
  const [tabIndex, setTabIndex] = useState(0);

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab !== null && TAB_INDEX[tab] !== undefined) {
      setTabIndex(TAB_INDEX[tab]);
    }
  }, []);

  const overview = useAsyncData<FrontOfficeOverview>(
    () => api<FrontOfficeOverview>('/api/v1/front-office/overview', { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:front-office:overview`,
  );

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
  const moveModal = useDisclosure();
  const noShowModal = useDisclosure();
  const incidentModal = useDisclosure();
  const resolveModal = useDisclosure();

  const [checkoutTarget, setCheckoutTarget] = useState<Stay | null>(null);
  const [checkoutNotes, setCheckoutNotes] = useState('');

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

  function checkIn(reservation: Reservation): void {
    void run(
      `check-in:${reservation.id}`,
      () =>
        api(`/api/v1/front-office/reservations/${reservation.id}/check-in`, {
          method: 'POST',
          tenant,
        }),
      `Check-in registrado para ${reservation.guest.fullName}`,
    );
  }

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
            ? `Día operativo ${formatCalendarDate(data.operationalDate)} · hora local ${data.localTime} · ${data.timezone} (inicio ${data.operationalDayStart}). La ocupación se deriva de estancias en casa, separada de housekeeping.`
            : 'Llegadas, estancias en casa, salidas, room rack e incidencias del día operativo.'
        }
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={reloadAll}
            isLoading={overview.loading && data !== null}
          >
            Actualizar
          </Button>
        }
      />

      <QueryFeedback
        loading={overview.loading && data === null}
        error={overview.error}
        onRetry={overview.reload}
        isEmpty={data === null}
        emptyText="No se pudo cargar el tablero operativo."
      >
        {data !== null && (
          <Stack spacing={5}>
            <SimpleGrid columns={{ base: 2, md: 3, xl: 6 }} spacing={3}>
              <MetricCard label="Llegadas" value={data.counts.arrivals} accent="sky" />
              <MetricCard label="En casa" value={data.counts.inHouse} accent="mint" />
              <MetricCard label="Salidas" value={data.counts.departures} accent="warning" />
              <MetricCard label="Libres" value={data.counts.vacantRooms} accent="mint" />
              <MetricCard label="Ocupadas" value={data.counts.occupiedRooms} accent="brand" />
              <MetricCard
                label="No-show por marcar"
                value={data.counts.noShowCandidates}
                hint="llegadas vencidas"
                accent="danger"
              />
            </SimpleGrid>

            <Tabs colorScheme="brand" index={tabIndex} onChange={setTabIndex} isLazy>
              <TabList>
                <Tab>Llegadas ({data.counts.arrivals})</Tab>
                <Tab>En casa ({data.counts.inHouse})</Tab>
                <Tab>Salidas ({data.counts.departures})</Tab>
                <Tab>Room rack ({data.roomRack.length})</Tab>
                <Tab>Incidencias</Tab>
              </TabList>

              <TabPanels>
                <TabPanel px={0}>
                  <SectionCard>
                    <Text fontWeight="semibold" mb={1}>
                      Llegadas del día operativo
                    </Text>
                    <Text fontSize="xs" color="gray.500" mb={3}>
                      Reservas confirmadas con llegada hasta {formatCalendarDate(operationalDate)}.
                      El check-in exige habitación asignada y disponible.
                    </Text>
                    <QueryFeedback
                      loading={false}
                      error={null}
                      isEmpty={data.arrivals.length === 0}
                      emptyText="No hay llegadas pendientes."
                    >
                      <Stack spacing={2}>
                        {data.arrivals.map((reservation) => {
                          const late = reservation.checkInDate < operationalDate;
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
                                  {missingRoom ? (
                                    <Button
                                      as={NextLink}
                                      href="/reservations"
                                      size="xs"
                                      variant="outline"
                                    >
                                      Asignar habitación
                                    </Button>
                                  ) : (
                                    <Button
                                      size="xs"
                                      colorScheme="brand"
                                      onClick={() => checkIn(reservation)}
                                      isLoading={busy === `check-in:${reservation.id}`}
                                    >
                                      Check-in
                                    </Button>
                                  )}
                                  {late && (
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
                      Huéspedes en casa
                    </Text>
                    <Text fontSize="xs" color="gray.500" mb={3}>
                      Estancias con check-in realizado. El check-out es idempotente y libera la
                      habitación.
                    </Text>
                    <QueryFeedback
                      loading={false}
                      error={null}
                      isEmpty={inHouse.length === 0}
                      emptyText="No hay huéspedes en casa."
                    >
                      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={2}>
                        {inHouse.map((stay) => (
                          <StayCard
                            key={stay.id}
                            stay={stay}
                            busy={busy}
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
                      Salidas pendientes
                    </Text>
                    <Text fontSize="xs" color="gray.500" mb={3}>
                      Estancias en casa cuya fecha de check-out ya llegó.
                    </Text>
                    <QueryFeedback
                      loading={false}
                      error={null}
                      isEmpty={data.departures.length === 0}
                      emptyText="No hay salidas pendientes para el día operativo."
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
                                </Text>
                              </Box>
                              <HStack spacing={1}>
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
                            </HStack>
                          </Box>
                        ))}
                      </Stack>
                    </QueryFeedback>
                  </SectionCard>
                </TabPanel>

                <TabPanel px={0}>
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

                <TabPanel px={0}>
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
