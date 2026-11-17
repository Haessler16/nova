'use client';

import {
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  HStack,
  IconButton,
  Link,
  SimpleGrid,
  Skeleton,
  SkeletonCircle,
  Stack,
  Text,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import { PropertyGate } from '@/components/app-shell';
import { ConnectionStatus } from '@/components/connection-status';
import { HealthStatus } from '@/components/health-status';
import {
  AlertItem,
  EmptyState,
  ErrorAlert,
  KeyValue,
  MetricCard,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui';
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  ArrivalIcon,
  BedIcon,
  CalendarIcon,
  CheckCircleIcon,
  DepartureIcon,
  FrontDeskIcon,
  GridIcon,
  KeyIcon,
  PlusIcon,
  RoomsIcon,
  SparkleIcon,
} from '@/components/icons';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import {
  formatCalendarDate,
  formatLongDate,
  RESERVATION_STATUS_COLORS,
  RESERVATION_STATUS_LABELS,
} from '@/lib/format';
import type { FrontOfficeOverview, OperationalDay, PropertyDetail, Reservation } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

interface DashboardBase {
  property: PropertyDetail;
  operationalDay: OperationalDay;
}

const ACTION_TONES = {
  brand: { bg: 'brand.50', color: 'brand.600' },
  sky: { bg: 'sky.50', color: 'sky.600' },
  mint: { bg: 'mint.50', color: 'mint.600' },
  warning: { bg: 'warning.50', color: 'warning.700' },
} as const;

const QUICK_ACTIONS = [
  {
    href: '/front-office',
    label: 'Front desk',
    description: 'Llegadas, salidas y estancias',
    icon: <FrontDeskIcon boxSize={5} />,
    tone: 'brand',
  },
  {
    href: '/reservations?new=1',
    label: 'Nueva reserva',
    description: 'Crear y asignar una estadía',
    icon: <PlusIcon boxSize={5} />,
    tone: 'sky',
  },
  {
    href: '/front-office?tab=arrivals',
    label: 'Check-in',
    description: 'Buscar una llegada pendiente',
    icon: <KeyIcon boxSize={5} />,
    tone: 'mint',
  },
  {
    href: '/front-office?tab=rack',
    label: 'Room rack',
    description: 'Ver ocupación y housekeeping',
    icon: <GridIcon boxSize={5} />,
    tone: 'warning',
  },
  {
    href: '/calendar',
    label: 'Calendario',
    description: 'Reservas por fecha',
    icon: <CalendarIcon boxSize={5} />,
    tone: 'brand',
  },
] as const;

function greetingFor(localTime: string): string {
  const hour = Number(localTime.slice(0, 2));
  if (!Number.isFinite(hour)) {
    return 'Bienvenido';
  }
  if (hour < 12) {
    return 'Buenos días';
  }
  if (hour < 19) {
    return 'Buenas tardes';
  }
  return 'Buenas noches';
}

function firstName(name: string | undefined): string {
  if (name === undefined || name.trim() === '') {
    return '';
  }
  return name.trim().split(/\s+/)[0] ?? '';
}

function QuickActions() {
  return (
    <Box>
      <HStack justify="space-between" align="baseline" mb={3}>
        <Heading size="sm">Accesos rápidos</Heading>
        <Text fontSize="xs" color="textSecondary">
          Lo más usado en recepción
        </Text>
      </HStack>
      <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 5 }} spacing={3}>
        {QUICK_ACTIONS.map((action) => {
          const tone = ACTION_TONES[action.tone];
          return (
            <Link
              key={action.href}
              as={NextLink}
              href={action.href}
              display="block"
              borderWidth="1px"
              borderColor="line"
              borderRadius="xl"
              bg="surface"
              boxShadow="card"
              p={4}
              color="inherit"
              transition="border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease"
              _hover={{
                borderColor: 'brand.300',
                boxShadow: 'cardHover',
                transform: 'translateY(-1px)',
                textDecoration: 'none',
              }}
              _focusVisible={{ boxShadow: 'focus', outline: 'none' }}
            >
              <HStack justify="space-between" align="flex-start">
                <Flex
                  boxSize="38px"
                  align="center"
                  justify="center"
                  borderRadius="lg"
                  bg={tone.bg}
                  color={tone.color}
                >
                  {action.icon}
                </Flex>
                <Box color="gray.300" mt={1}>
                  <ArrowRightIcon boxSize={4} />
                </Box>
              </HStack>
              <Text fontWeight="semibold" fontSize="sm" mt={3}>
                {action.label}
              </Text>
              <Text fontSize="xs" color="textSecondary" mt={0.5} noOfLines={2}>
                {action.description}
              </Text>
            </Link>
          );
        })}
      </SimpleGrid>
    </Box>
  );
}

function ArrivalsPanel({
  data,
  loading,
  operationalDate,
}: {
  data: FrontOfficeOverview | null;
  loading: boolean;
  operationalDate: string | null;
}) {
  const arrivals = data?.arrivals ?? [];
  const count = data?.counts.arrivals ?? 0;

  return (
    <SectionCard h="100%">
      <Flex justify="space-between" align="flex-start" gap={3} wrap="wrap">
        <Box>
          <Heading size="sm">Llegadas del día operativo</Heading>
          <Text fontSize="xs" color="textSecondary" mt={1}>
            {data !== null
              ? `${count} ${count === 1 ? 'huésped previsto' : 'huéspedes previstos'}${
                  operationalDate !== null ? ` · ${formatCalendarDate(operationalDate)}` : ''
                }`
              : 'Pendientes de confirmar desde Front Office.'}
          </Text>
        </Box>
        <Button
          as={NextLink}
          href="/front-office?tab=arrivals"
          size="xs"
          variant="ghost"
          rightIcon={<ArrowRightIcon boxSize={3.5} />}
        >
          Ver todas
        </Button>
      </Flex>

      <Divider my={4} />

      {loading && data === null ? (
        <Stack spacing={3}>
          {[0, 1, 2, 3].map((row) => (
            <HStack key={row} spacing={3} py={2}>
              <SkeletonCircle size="9" />
              <Box flex="1">
                <Skeleton height="14px" width="55%" borderRadius="md" />
                <Skeleton height="11px" width="75%" mt={2} borderRadius="md" />
              </Box>
              <Skeleton height="22px" width="72px" borderRadius="full" />
            </HStack>
          ))}
        </Stack>
      ) : arrivals.length === 0 ? (
        <EmptyState
          text="No hay llegadas pendientes para este día operativo."
          hint="Las reservas confirmadas para hoy aparecerán acá."
        />
      ) : (
        <Stack spacing={0}>
          {arrivals.slice(0, 6).map((reservation: Reservation) => (
            <Flex
              key={reservation.id}
              direction={{ base: 'column', sm: 'row' }}
              align={{ base: 'stretch', sm: 'center' }}
              justify="space-between"
              gap={3}
              py={3}
              borderBottomWidth="1px"
              borderColor="line"
              _last={{ borderBottomWidth: 0, pb: 0 }}
            >
              <HStack spacing={3} minW={0}>
                <Avatar
                  size="sm"
                  name={reservation.guest.fullName}
                  bg="sky.50"
                  color="sky.700"
                  fontWeight="bold"
                />
                <Box minW={0}>
                  <Text fontSize="sm" fontWeight="semibold" noOfLines={1}>
                    {reservation.guest.fullName}
                  </Text>
                  <Text fontSize="xs" color="textSecondary" noOfLines={1}>
                    {reservation.code} · {reservation.roomType.name} · {reservation.nights}{' '}
                    {reservation.nights === 1 ? 'noche' : 'noches'}
                  </Text>
                </Box>
              </HStack>
              <HStack spacing={3} justify="space-between" flexShrink={0}>
                <Box textAlign={{ base: 'left', sm: 'right' }}>
                  <StatusBadge
                    color={RESERVATION_STATUS_COLORS[reservation.status] ?? 'gray'}
                    label={RESERVATION_STATUS_LABELS[reservation.status]}
                  />
                  <Text fontSize="xs" color="textSecondary" mt={1}>
                    {reservation.room !== null
                      ? `Hab. ${reservation.room.number}`
                      : 'Sin habitación'}
                  </Text>
                </Box>
                <IconButton
                  as={NextLink}
                  href="/front-office?tab=arrivals"
                  aria-label={`Abrir llegada de ${reservation.guest.fullName}`}
                  icon={<ArrowRightIcon boxSize={4} />}
                  size="sm"
                  variant="ghost"
                  color="brand.600"
                />
              </HStack>
            </Flex>
          ))}
        </Stack>
      )}

      {arrivals.length > 6 && (
        <Button
          as={NextLink}
          href="/front-office?tab=arrivals"
          size="sm"
          variant="ghost"
          width="100%"
          mt={3}
          rightIcon={<ArrowRightIcon boxSize={4} />}
        >
          Ver las {arrivals.length} llegadas
        </Button>
      )}
    </SectionCard>
  );
}

function AlertsPanel({ data, loading }: { data: FrontOfficeOverview | null; loading: boolean }) {
  const dirtyRooms =
    data?.roomRack.filter(
      (room) => room.housekeepingState === 'DIRTY' || room.housekeepingState === 'CLEANING',
    ).length ?? 0;
  const outOfService =
    data?.roomRack.filter((room) => room.operationalState !== 'AVAILABLE').length ?? 0;
  const noShow = data?.counts.noShowCandidates ?? 0;

  const alerts = [
    ...(noShow > 0
      ? [
          {
            title: `${noShow} ${noShow === 1 ? 'reserva requiere' : 'reservas requieren'} atención`,
            description: 'Llegadas vencidas pendientes de no-show.',
            href: '/front-office?tab=arrivals',
            icon: <AlertTriangleIcon boxSize={4} />,
            tone: 'danger' as const,
          },
        ]
      : []),
    ...(dirtyRooms > 0
      ? [
          {
            title: `${dirtyRooms} ${
              dirtyRooms === 1 ? 'habitación espera' : 'habitaciones esperan'
            } limpieza`,
            description: 'Housekeeping pendiente en el room rack.',
            href: '/front-office?tab=rack',
            icon: <RoomsIcon boxSize={4} />,
            tone: 'warning' as const,
          },
        ]
      : []),
    ...(outOfService > 0
      ? [
          {
            title: `${outOfService} ${
              outOfService === 1 ? 'habitación fuera' : 'habitaciones fuera'
            } de servicio`,
            description: 'Bloqueos operativos activos en inventario.',
            href: '/inventory/rooms',
            icon: <RoomsIcon boxSize={4} />,
            tone: 'warning' as const,
          },
        ]
      : []),
  ];

  return (
    <SectionCard>
      <HStack justify="space-between" align="flex-start">
        <Box>
          <Heading size="sm">Alertas operativas</Heading>
          <Text fontSize="xs" color="textSecondary" mt={1}>
            Lo que conviene revisar ahora.
          </Text>
        </Box>
        <Flex
          boxSize="34px"
          align="center"
          justify="center"
          borderRadius="md"
          bg={alerts.length === 0 ? 'mint.50' : 'warning.50'}
          color={alerts.length === 0 ? 'mint.600' : 'warning.700'}
        >
          {alerts.length === 0 ? (
            <CheckCircleIcon boxSize={4} />
          ) : (
            <AlertTriangleIcon boxSize={4} />
          )}
        </Flex>
      </HStack>

      <Divider my={4} />

      {loading && data === null ? (
        <Stack spacing={2}>
          {[0, 1].map((row) => (
            <Skeleton key={row} height="58px" borderRadius="lg" />
          ))}
        </Stack>
      ) : alerts.length === 0 ? (
        <EmptyState
          text="Sin alertas operativas."
          hint="No hay limpieza pendiente, llegadas vencidas ni bloqueos activos."
        />
      ) : (
        <Stack spacing={1}>
          {alerts.map((alert) => (
            <AlertItem
              key={alert.title}
              title={alert.title}
              description={alert.description}
              href={alert.href}
              icon={alert.icon}
              tone={alert.tone}
            />
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}

function ContextPanel({
  property,
  operationalDay,
}: {
  property: PropertyDetail;
  operationalDay: OperationalDay;
}) {
  return (
    <SectionCard>
      <HStack justify="space-between" align="flex-start">
        <Box>
          <Heading size="sm">Contexto operativo</Heading>
          <Text fontSize="xs" color="textSecondary" mt={1}>
            Fechas y corte de la propiedad activa.
          </Text>
        </Box>
        <Badge colorScheme="mint">{property.timezone}</Badge>
      </HStack>
      <Divider my={4} />
      <Stack spacing={3}>
        <KeyValue
          label="Día operativo"
          value={formatCalendarDate(operationalDay.operationalDate)}
        />
        <KeyValue
          label="Hora local"
          value={`${operationalDay.localTime} · ${operationalDay.timezone}`}
        />
        <KeyValue label="Corte del día" value={operationalDay.operationalDayStart} />
        <KeyValue label="Propiedad" value={`${property.code} · ${property.currencyCode}`} />
      </Stack>
      <Divider my={4} />
      <HStack spacing={2} color="textSecondary">
        <SparkleIcon boxSize={4} color="brand.500" />
        <Text fontSize="xs">
          La ocupación y housekeeping son estados independientes; el backend es la autoridad.
        </Text>
      </HStack>
    </SectionCard>
  );
}

function DashboardSkeleton() {
  return (
    <Stack spacing={6}>
      <Box>
        <Skeleton height="12px" width="220px" borderRadius="md" />
        <Skeleton height="34px" width="420px" mt={3} borderRadius="md" />
        <Skeleton height="14px" width="320px" mt={3} borderRadius="md" />
      </Box>
      <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4}>
        {[0, 1, 2, 3].map((card) => (
          <Skeleton key={card} height="132px" borderRadius="xl" />
        ))}
      </SimpleGrid>
      <Skeleton height="120px" borderRadius="xl" />
      <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={5}>
        <Skeleton gridColumn={{ xl: 'span 2' }} height="360px" borderRadius="xl" />
        <Skeleton height="360px" borderRadius="xl" />
      </SimpleGrid>
    </Stack>
  );
}

function DashboardContent() {
  const { tenant, property, organization, actor } = useSession();

  const base = useAsyncData<DashboardBase>(async () => {
    const [propertyDetail, operationalDay] = await Promise.all([
      api<PropertyDetail>('/api/v1/properties/current', { tenant }),
      api<OperationalDay>('/api/v1/properties/current/operational-day', { tenant }),
    ]);
    return { property: propertyDetail, operationalDay };
  }, `${tenant.organizationId}:${tenant.propertyId}:dashboard:base`);

  const overview = useAsyncData<FrontOfficeOverview>(
    () => api<FrontOfficeOverview>('/api/v1/front-office/overview', { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:dashboard:overview`,
  );

  const operationalDay = base.data?.operationalDay ?? null;
  const propertyDetail = base.data?.property ?? null;
  const overviewData = overview.data;

  const totalRooms =
    (overviewData?.counts.occupiedRooms ?? 0) + (overviewData?.counts.vacantRooms ?? 0);
  const occupancy =
    totalRooms > 0
      ? Math.round(((overviewData?.counts.occupiedRooms ?? 0) / totalRooms) * 100)
      : null;
  const readyRooms =
    overviewData?.roomRack.filter(
      (room) =>
        room.occupancy === 'VACANT' &&
        room.operationalState === 'AVAILABLE' &&
        (room.housekeepingState === 'CLEAN' || room.housekeepingState === 'INSPECTED'),
    ).length ?? 0;

  function reloadAll(): void {
    base.reload();
    overview.reload();
  }

  if (base.loading && base.data === null) {
    return <DashboardSkeleton />;
  }

  if (base.error !== null && base.error !== undefined) {
    return <ErrorAlert error={base.error} onRetry={base.reload} />;
  }

  if (propertyDetail === null || operationalDay === null) {
    return (
      <EmptyState
        text="No se pudo cargar el contexto de la propiedad."
        hint="Revisá la conexión con la API y volvé a intentar."
      />
    );
  }

  const displayName = firstName(actor?.name);
  const greeting = greetingFor(operationalDay.localTime);

  return (
    <>
      <PageHeader
        eyebrow="NOVA PMS · Hotel Management"
        title={`${greeting}${displayName !== '' ? `, ${displayName}` : ''}`}
        description={`${formatLongDate(operationalDay.localDate)} · Front Desk · ${
          property?.name ?? propertyDetail.name
        } (${organization?.name ?? 'Organización'})`}
        actions={
          <>
            <Box display={{ base: 'block', sm: 'none' }}>
              <ConnectionStatus />
            </Box>
            <Button
              size="sm"
              variant="outline"
              onClick={reloadAll}
              isLoading={base.loading || overview.loading}
            >
              Actualizar
            </Button>
            <Button as={NextLink} href="/front-office" size="sm">
              Abrir Front Desk
            </Button>
          </>
        }
      />

      <Stack spacing={6}>
        {overview.error !== null && overview.error !== undefined ? (
          <SectionCard>
            <Heading size="sm" mb={1}>
              Métricas operativas no disponibles
            </Heading>
            <Text fontSize="xs" color="textSecondary" mb={3}>
              El contexto de la propiedad cargó correctamente, pero no se pudo obtener el tablero de
              Front Office. No se muestran cifras inventadas.
            </Text>
            <ErrorAlert error={overview.error} onRetry={overview.reload} />
          </SectionCard>
        ) : (
          <>
            <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4}>
              <MetricCard
                label="Ocupación"
                value={occupancy !== null ? `${occupancy}%` : '—'}
                hint={
                  overviewData !== null
                    ? `${overviewData.counts.occupiedRooms} de ${totalRooms} habitaciones ocupadas`
                    : 'Calculada con estancias en casa'
                }
                icon={<BedIcon boxSize={5} />}
                accent="brand"
                progress={occupancy ?? undefined}
                loading={overview.loading && overviewData === null}
              />
              <MetricCard
                label="Llegadas"
                value={overviewData?.counts.arrivals ?? '—'}
                hint="Previstas para el día operativo"
                icon={<ArrivalIcon boxSize={5} />}
                accent="sky"
                loading={overview.loading && overviewData === null}
              />
              <MetricCard
                label="Salidas"
                value={overviewData?.counts.departures ?? '—'}
                hint="Estancias con check-out pendiente"
                icon={<DepartureIcon boxSize={5} />}
                accent="warning"
                loading={overview.loading && overviewData === null}
              />
              <MetricCard
                label="Habitaciones listas"
                value={overviewData !== null ? readyRooms : '—'}
                hint="Libres, operativas y con housekeeping listo"
                icon={<KeyIcon boxSize={5} />}
                accent="mint"
                loading={overview.loading && overviewData === null}
              />
            </SimpleGrid>

            <QuickActions />

            <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={5} alignItems="start">
              <Box gridColumn={{ xl: 'span 2' }} minW={0}>
                <ArrivalsPanel
                  data={overviewData}
                  loading={overview.loading}
                  operationalDate={operationalDay.operationalDate}
                />
              </Box>
              <Stack spacing={5} minW={0}>
                <AlertsPanel data={overviewData} loading={overview.loading} />
                <ContextPanel property={propertyDetail} operationalDay={operationalDay} />
              </Stack>
            </SimpleGrid>
          </>
        )}

        <Box>
          <Heading size="sm" mb={3}>
            Estado de la plataforma
          </Heading>
          <HealthStatus />
        </Box>

        <Text fontSize="xs" color="textSecondary">
          Check-in, check-out, room rack y folios se operan desde Front Office. Este panel es de
          solo lectura y no modifica inventario ni reservas.
        </Text>
      </Stack>
    </>
  );
}

export default function DashboardPage() {
  return (
    <PropertyGate>
      <DashboardContent />
    </PropertyGate>
  );
}
