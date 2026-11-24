'use client';

import { Box, Flex, Text } from '@chakra-ui/react';
import { formatCalendarDate, nightsBetween, weekdayShort } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Reservation, Room } from '@/lib/types';
import { BAR_COLORS, DAY_WIDTH, ROOM_COLUMN_WIDTH } from '../_lib/calendar-constants';

function isWeekend(date: string): boolean {
  return [0, 6].includes(new Date(`${date}T00:00:00.000Z`).getUTCDay());
}

function CalendarHeaderRow({ dates, today }: { dates: string[]; today: string }) {
  const { t } = useI18n();

  return (
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
          {t('calendar.table.room')}
        </Text>
      </Box>
      {dates.map((date) => {
        const isToday = date === today;
        const weekend = isWeekend(date);
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
  );
}

function CalendarRoomRow({
  room,
  reservations,
  dates,
  startDate,
  days,
  today,
  onSelect,
}: {
  room: Room;
  reservations: Reservation[];
  dates: string[];
  startDate: string;
  days: number;
  today: string;
  onSelect: (reservation: Reservation) => void;
}) {
  return (
    <Flex borderBottomWidth="1px" borderColor="gray.200" _hover={{ bg: 'gray.50' }}>
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
          {dates.map((date) => (
            <Box
              key={date}
              w={`${DAY_WIDTH}px`}
              minW={`${DAY_WIDTH}px`}
              borderRightWidth="1px"
              borderColor="gray.100"
              bg={date === today ? 'brand.50' : isWeekend(date) ? 'gray.50' : 'white'}
            />
          ))}
        </Flex>
        {reservations.map((reservation) => {
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
              onClick={() => onSelect(reservation)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  onSelect(reservation);
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
}

export function CalendarGrid({
  rooms,
  assigned,
  dates,
  startDate,
  days,
  today,
  onSelect,
}: {
  rooms: Room[];
  assigned: Reservation[];
  dates: string[];
  startDate: string;
  days: number;
  today: string;
  onSelect: (reservation: Reservation) => void;
}) {
  return (
    <Box overflowX="auto" maxH="calc(100vh - 280px)">
      <Box minW={`${ROOM_COLUMN_WIDTH + days * DAY_WIDTH}px`}>
        <CalendarHeaderRow dates={dates} today={today} />
        {rooms.map((room) => (
          <CalendarRoomRow
            key={room.id}
            room={room}
            reservations={assigned.filter((reservation) => reservation.room?.id === room.id)}
            dates={dates}
            startDate={startDate}
            days={days}
            today={today}
            onSelect={onSelect}
          />
        ))}
      </Box>
    </Box>
  );
}
