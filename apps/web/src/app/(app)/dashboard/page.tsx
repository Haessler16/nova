'use client';

import {
  Badge,
  Box,
  Button,
  Divider,
  Heading,
  HStack,
  Link,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import { PropertyGate } from '@/components/app-shell';
import { HealthStatus } from '@/components/health-status';
import { KeyValue, PageHeader, QueryFeedback, SectionCard } from '@/components/ui';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import { formatCalendarDate } from '@/lib/format';
import type { OperationalDay, PropertyDetail } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

interface DashboardData {
  property: PropertyDetail;
  operationalDay: OperationalDay;
}

function DashboardContent() {
  const { tenant, property, organization, actor } = useSession();
  const { data, loading, error, reload } = useAsyncData<DashboardData>(async () => {
    const [propertyDetail, operationalDay] = await Promise.all([
      api<PropertyDetail>('/api/v1/properties/current', { tenant }),
      api<OperationalDay>('/api/v1/properties/current/operational-day', { tenant }),
    ]);
    return { property: propertyDetail, operationalDay };
  }, `${tenant.organizationId}:${tenant.propertyId}:dashboard`);

  return (
    <>
      <PageHeader
        title="Panel operativo"
        description={`${organization?.name ?? 'Organización'} · ${property?.name ?? 'Propiedad'} — estado de la base operativa y accesos rápidos.`}
        actions={
          <Button as={NextLink} href="/reservations" colorScheme="purple" size="sm">
            Ir a reservas
          </Button>
        }
      />

      <QueryFeedback loading={loading} error={error} onRetry={reload}>
        {data !== null && (
          <Stack spacing={6}>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              <SectionCard>
                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wide">
                  Día operativo
                </Text>
                <Heading size="lg" mt={1}>
                  {formatCalendarDate(data.operationalDay.operationalDate)}
                </Heading>
                <Text fontSize="sm" color="gray.600">
                  Hora local {data.operationalDay.localTime} · corte{' '}
                  {data.operationalDay.operationalDayStart}
                </Text>
                <Badge mt={3} colorScheme="purple">
                  {data.operationalDay.timezone}
                </Badge>
              </SectionCard>

              <SectionCard>
                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wide">
                  Propiedad
                </Text>
                <Heading size="md" mt={1}>
                  {data.property.name}
                </Heading>
                <Stack spacing={2} mt={3}>
                  <KeyValue label="Código" value={data.property.code} />
                  <KeyValue label="Moneda" value={data.property.currencyCode} />
                  <KeyValue
                    label="Estado"
                    value={
                      <Badge colorScheme={data.property.status === 'ACTIVE' ? 'green' : 'gray'}>
                        {data.property.status}
                      </Badge>
                    }
                  />
                </Stack>
              </SectionCard>

              <SectionCard>
                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wide">
                  Sesión
                </Text>
                <Heading size="md" mt={1}>
                  {actor?.name}
                </Heading>
                <Text fontSize="sm" color="gray.600" noOfLines={1}>
                  {actor?.email}
                </Text>
                <Divider my={3} />
                <Text fontSize="sm" color="gray.600">
                  Rol de organización:{' '}
                  {organization?.role?.name ?? 'Staff con permisos de propiedad'}
                </Text>
              </SectionCard>
            </SimpleGrid>

            <SectionCard>
              <Heading size="sm" mb={3}>
                Accesos rápidos
              </Heading>
              <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={3}>
                {[
                  {
                    href: '/reservations',
                    title: 'Reservas',
                    text: 'Disponibilidad, asignación y cancelación.',
                  },
                  {
                    href: '/guests',
                    title: 'Huéspedes',
                    text: 'Perfiles minimizados y búsqueda asistida.',
                  },
                  {
                    href: '/inventory/rooms',
                    title: 'Habitaciones',
                    text: 'Housekeeping, bloqueos e historial.',
                  },
                  {
                    href: '/inventory/room-types',
                    title: 'Tipos',
                    text: 'Capacidad y configuración de tipologías.',
                  },
                ].map((item) => (
                  <Link
                    key={item.href}
                    as={NextLink}
                    href={item.href}
                    borderWidth="1px"
                    borderRadius="md"
                    p={4}
                    _hover={{ borderColor: 'purple.400', bg: 'purple.50' }}
                  >
                    <Text fontWeight="semibold" fontSize="sm">
                      {item.title}
                    </Text>
                    <Text fontSize="xs" color="gray.600" mt={1}>
                      {item.text}
                    </Text>
                  </Link>
                ))}
              </SimpleGrid>
            </SectionCard>

            <Box>
              <Heading size="sm" mb={3}>
                Estado de la plataforma
              </Heading>
              <HealthStatus />
            </Box>

            <Text fontSize="xs" color="gray.500">
              Check-in/check-out, room rack y folios pertenecen a las siguientes fases. Esta
              pantalla no modifica inventario ni reservas.
            </Text>
          </Stack>
        )}
      </QueryFeedback>
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
