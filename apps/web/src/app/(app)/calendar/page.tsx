'use client';

import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Stack,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import { useState } from 'react';
import { PropertyGate } from '@/components/app-shell';
import { KeyValue, PageHeader, QueryFeedback, SectionCard, StatusBadge } from '@/components/ui';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import {
  RESERVATION_STATUS_COLORS,
  RESERVATION_STATUS_LABELS,
  addDaysISO,
  formatCalendarDate,
  nightsBetween,
  todayISO,
  weekdayShort,
} from '@/lib/format';
import type { Reservation, Room } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

const DAY_WIDTH = 76;
const ROOM_COLUMN_WIDTH = 168;

const BAR_COLORS: Record<Reservation['status'], string> = {
  CONFIRMED: 'brand.500',
  CHECKED_IN: 'mint.500',
  CHECKED_OUT: 'sky.500',
  CANCELLED: 'gray.400',
  NO_SHOW: 'warning.500',
};

function CalendarContent() {
  const { tenant } = useSession();
  const [startDate, setStartDate] = useState(todayISO());
  const [days, setDays] = useState(14);
  const detail = useDisclosure();
  const [selected, setSelected] = useState<Reservation | null>(null);

  const endDate = addDaysISO(startDate, days);
  const dates = Array.from({ length: days }, (_, index) => addDaysISO(startDate, index));
  const today = todayISO();

  const { data, loading, error, reload } = useAsyncData<{
    rooms: Room[];
    reservations: Reservation[];
  }>(async () => {
    const [rooms, reservations] = await Promise.all([
      api<{ items: Room[] }>('/api/v1/inventory/rooms?status=ACTIVE&limit=100', { tenant }),
      api<{ items: Reservation[] }>(
        `/api/v1/reservations?fromDate=${startDate}&toDate=${endDate}&limit=100`,
        { tenant },
      ),
    ]);
    return {
      rooms: rooms.items,
      reservations: reservations.items.filter((reservation) => reservation.status !== 'CANCELLED'),
    };
  }, `${tenant.organizationId}:${tenant.propertyId}:calendar:${startDate}:${days}`);

  const assigned = data?.reservations.filter((reservation) => reservation.room !== null) ?? [];
  const unassigned =
    data?.reservations.filter(
      (reservation) => reservation.room === null && reservation.status !== 'NO_SHOW',
    ) ?? [];

  return (
    <>
      <PageHeader
        title="Calendario de reservas"
        description="Ocupación por habitación y noche. La estancia ocupa [check-in, check-out); una salida puede coincidir con la llegada siguiente."
        actions={
          <Button as={NextLink} href="/reservations" size="sm" colorScheme="brand">
            Nueva reserva
          </Button>
        }
      />

      <SectionCard p={0} overflow="hidden">
        <Flex
          px={4}
          py={3}
          gap={3}
          wrap="wrap"
          align="center"
          borderBottomWidth="1px"
          borderColor="gray.200"
        >
          <HStack spacing={1}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStartDate(addDaysISO(startDate, -7))}
            >
              ← 7 días
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStartDate(today)}>
              Hoy
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStartDate(addDaysISO(startDate, 7))}
            >
              7 días →
            </Button>
          </HStack>
          <HStack spacing={2}>
            <Text fontSize="sm" color="gray.600">
              Desde
            </Text>
            <input
              type="date"
              value={startDate}
              onChange={(event) => {
                if (event.target.value !== '') {
                  setStartDate(event.target.value);
                }
              }}
              style={{
                border: '1px solid #E2E8F0',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 14,
              }}
              aria-label="Fecha inicial del calendario"
            />
            <Select
              size="sm"
              width="110px"
              aria-label="Días visibles"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
            >
              <option value={7}>7 días</option>
              <option value={14}>14 días</option>
              <option value={21}>21 días</option>
            </Select>
          </HStack>
          <HStack spacing={3} ml="auto" wrap="wrap">
            {(['CONFIRMED', 'CHECKED_IN', 'NO_SHOW'] as const).map((status) => (
              <HStack key={status} spacing={1}>
                <Box boxSize="10px" borderRadius="sm" bg={BAR_COLORS[status]} />
                <Text fontSize="xs" color="gray.600">
                  {RESERVATION_STATUS_LABELS[status]}
                </Text>
              </HStack>
            ))}
            {data !== null && (
              <Text fontSize="xs" color="gray.500">
                {assigned.length} reservas asignadas
                {unassigned.length > 0 ? ` · ${unassigned.length} sin asignar` : ''}
              </Text>
            )}
          </HStack>
        </Flex>

        <QueryFeedback
          loading={loading}
          error={error}
          onRetry={reload}
          isEmpty={(data?.rooms.length ?? 0) === 0}
          emptyText="No hay habitaciones activas en esta propiedad."
        >
          {data !== null && (
            <Box overflowX="auto" maxH="calc(100vh - 280px)">
              <Box minW={`${ROOM_COLUMN_WIDTH + days * DAY_WIDTH}px`}>
                <Flex
                  position="sticky"
                  top={0}
                  zIndex={4}
                  bg="gray.50"
                  borderBottomWidth="1px"
                  borderColor="gray.200"
                >
                  <Box
                    position="sticky"
                    left={0}
                    zIndex={5}
                    w={`${ROOM_COLUMN_WIDTH}px`}
                    minW={`${ROOM_COLUMN_WIDTH}px`}
                    px={3}
                    py={2}
                    bg="gray.50"
                    borderRightWidth="1px"
                    borderColor="gray.200"
                  >
                    <Text fontSize="xs" fontWeight="semibold" color="gray.600">
                      Habitación
                    </Text>
                  </Box>
                  {dates.map((date) => {
                    const isToday = date === today;
                    const weekend = [0, 6].includes(new Date(`${date}T00:00:00.000Z`).getUTCDay());
                    return (
                      <Box
                        key={date}
                        w={`${DAY_WIDTH}px`}
                        minW={`${DAY_WIDTH}px`}
                        px={2}
                        py={1}
                        textAlign="center"
                        borderRightWidth="1px"
                        borderColor="gray.200"
                        bg={isToday ? 'brand.50' : weekend ? 'gray.100' : 'gray.50'}
                      >
                        <Text fontSize="xs" color="gray.500" textTransform="uppercase">
                          {weekdayShort(date)}
                        </Text>
                        <Text
                          fontSize="sm"
                          fontWeight={isToday ? 'bold' : 'medium'}
                          color={isToday ? 'brand.700' : 'gray.800'}
                        >
                          {date.slice(8, 10)}/{date.slice(5, 7)}
                        </Text>
                      </Box>
                    );
                  })}
                </Flex>

                {data.rooms.map((room) => {
                  const roomReservations = assigned.filter(
                    (reservation) => reservation.room?.id === room.id,
                  );
                  return (
                    <Flex
                      key={room.id}
                      borderBottomWidth="1px"
                      borderColor="gray.200"
                      _hover={{ bg: 'gray.50' }}
                    >
                      <Box
                        position="sticky"
                        left={0}
                        zIndex={2}
                        w={`${ROOM_COLUMN_WIDTH}px`}
                        minW={`${ROOM_COLUMN_WIDTH}px`}
                        px={3}
                        py={2}
                        bg="white"
                        borderRightWidth="1px"
                        borderColor="gray.200"
                      >
                        <Text fontWeight="semibold" fontSize="sm">
                          {room.number}
                        </Text>
                        <Text fontSize="xs" color="gray.500" noOfLines={1}>
                          {room.roomType.name}
                        </Text>
                      </Box>
                      <Box position="relative" h="52px" flex="1">
                        <Flex position="absolute" inset={0}>
                          {dates.map((date) => {
                            const weekend = [0, 6].includes(
                              new Date(`${date}T00:00:00.000Z`).getUTCDay(),
                            );
                            return (
                              <Box
                                key={date}
                                w={`${DAY_WIDTH}px`}
                                minW={`${DAY_WIDTH}px`}
                                borderRightWidth="1px"
                                borderColor="gray.100"
                                bg={date === today ? 'brand.50' : weekend ? 'gray.50' : 'white'}
                              />
                            );
                          })}
                        </Flex>
                        {roomReservations.map((reservation) => {
                          const offset = nightsBetween(startDate, reservation.checkInDate);
                          const endOffset = nightsBetween(startDate, reservation.checkOutDate);
                          const from = Math.max(0, offset);
                          const to = Math.min(days, endOffset);
                          if (to <= 0 || from >= days) {
                            return null;
                          }
                          const width = (to - from) * DAY_WIDTH - 6;
                          return (
                            <Box
                              key={reservation.id}
                              role="button"
                              tabIndex={0}
                              position="absolute"
                              left={`${from * DAY_WIDTH + 3}px`}
                              top="7px"
                              width={`${Math.max(width, 20)}px`}
                              height="38px"
                              bg={BAR_COLORS[reservation.status]}
                              color="white"
                              borderRadius="md"
                              px={2}
                              py={1}
                              cursor="pointer"
                              overflow="hidden"
                              title={`${reservation.code} · ${reservation.guest.fullName} · ${formatCalendarDate(
                                reservation.checkInDate,
                              )} → ${formatCalendarDate(reservation.checkOutDate)}`}
                              onClick={() => {
                                setSelected(reservation);
                                detail.onOpen();
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  setSelected(reservation);
                                  detail.onOpen();
                                }
                              }}
                              _hover={{ filter: 'brightness(0.9)' }}
                            >
                              <Text fontSize="xs" fontWeight="semibold" noOfLines={1}>
                                {reservation.guest.fullName}
                              </Text>
                              <Text fontSize="10px" opacity={0.9} noOfLines={1}>
                                {reservation.code} · {reservation.nights}n
                              </Text>
                            </Box>
                          );
                        })}
                      </Box>
                    </Flex>
                  );
                })}
              </Box>
            </Box>
          )}
        </QueryFeedback>
      </SectionCard>

      {unassigned.length > 0 && (
        <Box mt={6}>
          <SectionCard>
            <Text fontWeight="semibold" mb={1}>
              Reservas sin habitación en el rango
            </Text>
            <Text fontSize="xs" color="gray.500" mb={3}>
              Asigná una habitación desde Reservas o directamente al hacer check-in en Front Office.
            </Text>
            <Stack spacing={2}>
              {unassigned.map((reservation) => (
                <HStack
                  key={reservation.id}
                  justify="space-between"
                  borderWidth="1px"
                  borderRadius="md"
                  px={3}
                  py={2}
                  wrap="wrap"
                >
                  <Box>
                    <HStack spacing={2}>
                      <Text fontSize="sm" fontWeight="medium">
                        {reservation.guest.fullName}
                      </Text>
                      <StatusBadge
                        color={RESERVATION_STATUS_COLORS[reservation.status]}
                        label={RESERVATION_STATUS_LABELS[reservation.status]}
                      />
                    </HStack>
                    <Text fontSize="xs" color="gray.500">
                      {reservation.code} · {formatCalendarDate(reservation.checkInDate)} →{' '}
                      {formatCalendarDate(reservation.checkOutDate)} · {reservation.roomType.name}
                    </Text>
                  </Box>
                  <Button as={NextLink} href="/reservations" size="xs" variant="outline">
                    Asignar en Reservas
                  </Button>
                </HStack>
              ))}
            </Stack>
          </SectionCard>
        </Box>
      )}

      <Modal isOpen={detail.isOpen} onClose={detail.onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontSize="md">
            {selected?.code} · {selected?.guest.fullName}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {selected !== null && (
              <Stack spacing={4}>
                <HStack>
                  <StatusBadge
                    color={RESERVATION_STATUS_COLORS[selected.status]}
                    label={RESERVATION_STATUS_LABELS[selected.status]}
                  />
                  <Badge colorScheme="brand" textTransform="none">
                    Hab. {selected.room?.number ?? 'sin asignar'}
                  </Badge>
                </HStack>
                <SimpleGrid columns={2} spacing={3}>
                  <KeyValue label="Check-in" value={formatCalendarDate(selected.checkInDate)} />
                  <KeyValue label="Check-out" value={formatCalendarDate(selected.checkOutDate)} />
                  <KeyValue label="Noches" value={selected.nights} />
                  <KeyValue label="Tipo" value={selected.roomType.name} />
                  <KeyValue
                    label="Ocupación"
                    value={`${selected.adults} adultos · ${selected.children} menores`}
                  />
                  <KeyValue label="Origen" value={selected.source ?? 'directa'} />
                </SimpleGrid>
                {selected.notes !== null && (
                  <Text fontSize="sm" color="gray.600" whiteSpace="pre-wrap">
                    {selected.notes}
                  </Text>
                )}
                <HStack>
                  <Button as={NextLink} href="/reservations" size="sm" colorScheme="brand">
                    Abrir en Reservas
                  </Button>
                  <Button size="sm" variant="ghost" onClick={detail.onClose}>
                    Cerrar
                  </Button>
                </HStack>
              </Stack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}

export default function CalendarPage() {
  return (
    <PropertyGate>
      <CalendarContent />
    </PropertyGate>
  );
}
