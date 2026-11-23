'use client';

import {
  Badge,
  Box,
  Button,
  HStack,
  Stack,
  TabPanel,
  Text,
} from '@chakra-ui/react';
import { ReservationDocuments } from '@/components/documents-panel';
import { QueryFeedback, SectionCard, StatusBadge } from '@/components/ui';
import { RESERVATION_STATUS_COLORS, formatCalendarDate, reservationStatusLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { FrontOfficeOverview, Reservation } from '@/lib/types';
import { adultsLabel, minorsLabel, nightsLabel } from '../_lib/front-office.types';

function ArrivalRow({
  reservation,
  operationalDate,
  isHistorical,
  busy,
  onCheckIn,
  onNoShow,
}: {
  reservation: Reservation;
  operationalDate: string;
  isHistorical: boolean;
  busy: string | null;
  onCheckIn: (reservation: Reservation) => void;
  onNoShow: (reservation: Reservation) => void;
}) {
  const { t, locale } = useI18n();
  const late = !isHistorical && reservation.checkInDate < operationalDate;
  const missingRoom = reservation.room === null;
  return (
    <Box borderWidth="1px" borderRadius="md" px={3} py={2}>
      <HStack justify="space-between" align="flex-start" wrap="wrap">
        <Box>
          <HStack spacing={2} wrap="wrap">
            <Text fontSize="sm" fontWeight="semibold">
              {reservation.guest.fullName}
            </Text>
            <StatusBadge
              color={RESERVATION_STATUS_COLORS[reservation.status] ?? 'gray'}
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
            {formatCalendarDate(reservation.checkOutDate)} · {nightsLabel(t, reservation.nights)}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {t('frontOffice.arrivals.roomLabel')}{' '}
            {reservation.room !== null
              ? reservation.room.number
              : t('frontOffice.arrivals.unassigned')}{' '}
            · {adultsLabel(t, reservation.adults)}
            {reservation.children > 0 ? ` · ${minorsLabel(t, reservation.children)}` : ''}
          </Text>
        </Box>
        <HStack spacing={1} wrap="wrap">
          <ReservationDocuments
            reservationId={reservation.id}
            reservationCode={reservation.code}
          />
          {!isHistorical && (
            <Button
              size="xs"
              colorScheme="brand"
              onClick={() => onCheckIn(reservation)}
              isLoading={busy === `check-in:${reservation.id}`}
            >
              {t('frontOffice.action.checkIn')}
            </Button>
          )}
          {!isHistorical && late && (
            <Button
              size="xs"
              variant="outline"
              colorScheme="warning"
              onClick={() => onNoShow(reservation)}
            >
              {t('frontOffice.action.noShow')}
            </Button>
          )}
        </HStack>
      </HStack>
    </Box>
  );
}

export function ArrivalsPanel({
  data,
  busy,
  onCheckIn,
  onNoShow,
}: {
  data: FrontOfficeOverview;
  busy: string | null;
  onCheckIn: (reservation: Reservation) => void;
  onNoShow: (reservation: Reservation) => void;
}) {
  const { t } = useI18n();
  return (
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
                date: formatCalendarDate(data.operationalDate),
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
            {data.arrivals.map((reservation) => (
              <ArrivalRow
                key={reservation.id}
                reservation={reservation}
                operationalDate={data.operationalDate}
                isHistorical={data.isHistorical}
                busy={busy}
                onCheckIn={onCheckIn}
                onNoShow={onNoShow}
              />
            ))}
          </Stack>
        </QueryFeedback>
      </SectionCard>
    </TabPanel>
  );
}
