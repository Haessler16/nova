'use client';

import {
  Badge,
  Box,
  Button,
  Divider,
  HStack,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import { errorMessage } from '@/lib/api';
import { ReservationDocuments } from '@/components/documents-panel';
import { ReservationInstructions } from '@/components/instructions-panel';
import { ReservationParty } from '@/components/reservation-party';
import { KeyValue, QueryFeedback, StatusBadge } from '@/components/ui';
import {
  RESERVATION_STATUS_COLORS,
  documentTypeLabel,
  formatCalendarDate,
  formatDateTime,
  reservationStatusLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Guest, Reservation, ReservationHistoryEntry } from '@/lib/types';
import { actionLabel, adultsLabel, childrenLabel } from '../_lib/reservation-labels';
import type { ReservationDetailController } from '../_hooks/use-reservation-detail';
import type { ReservationRoomActions } from '../_hooks/use-reservation-room-actions';
import { RoomChoiceGrid } from './room-choice-grid';

export function DetailOverview({
  reservation,
  guest,
  onEditGuest,
  onChanged,
}: {
  reservation: Reservation;
  guest: Guest | null;
  onEditGuest: (guest: Guest) => void;
  onChanged: () => void;
}) {
  const { t, locale } = useI18n();

  return (
    <>
      <HStack justify="space-between" align="start">
        <HStack wrap="wrap">
          <StatusBadge
            color={RESERVATION_STATUS_COLORS[reservation.status]}
            label={reservationStatusLabel(locale, reservation.status)}
          />
          {reservation.source !== null && <Badge colorScheme="gray">{reservation.source}</Badge>}
        </HStack>
        <ReservationDocuments
          reservationId={reservation.id}
          reservationCode={reservation.code}
        />
      </HStack>

      <SimpleGrid columns={2} spacing={3}>
        <KeyValue
          label={t('reservations.field.checkIn')}
          value={formatCalendarDate(reservation.checkInDate)}
        />
        <KeyValue
          label={t('reservations.field.checkOut')}
          value={formatCalendarDate(reservation.checkOutDate)}
        />
        <KeyValue label={t('reservations.detail.nights')} value={reservation.nights} />
        <KeyValue
          label={t('reservations.detail.occupancy')}
          value={t('reservations.detail.occupancyValue', {
            adults: adultsLabel(t, reservation.adults),
            children: childrenLabel(t, reservation.children),
          })}
        />
        <KeyValue label={t('reservations.detail.type')} value={reservation.roomType.name} />
        <KeyValue
          label={t('reservations.detail.room')}
          value={
            reservation.room !== null
              ? t('reservations.roomPrefix', { number: reservation.room.number })
              : t('reservations.unassigned')
          }
        />
        <KeyValue label={t('reservations.detail.guest')} value={reservation.guest.fullName} />
        <KeyValue
          label={t('reservations.detail.contact')}
          value={reservation.guest.email ?? reservation.guest.phone ?? '—'}
        />
        <KeyValue
          label={t('reservations.detail.document')}
          value={
            guest?.documentType != null
              ? `${documentTypeLabel(locale, guest.documentType)} ${guest.documentNumber ?? ''}`
              : t('reservations.guest.noDocument')
          }
        />
      </SimpleGrid>
      {guest !== null && (
        <Button
          size="xs"
          variant="outline"
          alignSelf="flex-start"
          onClick={() => onEditGuest(guest)}
        >
          {t('reservations.guestEdit.title')}
        </Button>
      )}

      <ReservationParty
        reservationId={reservation.id}
        checkInDate={reservation.checkInDate}
        editable={reservation.status === 'CONFIRMED'}
        onChanged={onChanged}
      />

      <ReservationInstructions
        reservationId={reservation.id}
        canManage={
          reservation.status !== 'CANCELLED' && reservation.status !== 'CHECKED_OUT'
        }
        onChanged={onChanged}
      />

      {reservation.notes !== null && (
        <Box>
          <Text fontSize="xs" color="textSecondary" textTransform="uppercase">
            {t('reservations.detail.notes')}
          </Text>
          <Text fontSize="sm" whiteSpace="pre-wrap">
            {reservation.notes}
          </Text>
        </Box>
      )}
    </>
  );
}

export function DetailRoomAssignment({
  reservation,
  detail,
  roomActions,
}: {
  reservation: Reservation;
  detail: ReservationDetailController;
  roomActions: ReservationRoomActions;
}) {
  const { t } = useI18n();
  const { loading, error } = detail.detailAvailability;
  const { assignRoomId, saving } = roomActions;
  const items = detail.detailAvailability.data?.items ?? [];

  return (
    <>
      <Divider />
      <Box>
        <Text fontWeight="semibold" mb={2}>
          {t('reservations.section.room')}
        </Text>
        {loading ? (
          <Text fontSize="sm" color="textSecondary">
            {t('reservations.room.checking')}
          </Text>
        ) : error !== null ? (
          <Text fontSize="sm" color="danger.500">
            {errorMessage(error)}
          </Text>
        ) : items.length === 0 ? (
          <Text fontSize="sm" color="warning.600">
            {t('reservations.room.noneForDates')}
          </Text>
        ) : (
          <RoomChoiceGrid
            items={items}
            value={assignRoomId}
            onChange={roomActions.setAssignRoomId}
            disabled={saving}
          />
        )}
        <HStack mt={3} spacing={2} wrap="wrap">
          <Button
            size="sm"
            colorScheme="brand"
            onClick={() => void roomActions.handleAssign()}
            isLoading={saving}
            isDisabled={assignRoomId === ''}
          >
            {t('reservations.room.assign')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            colorScheme="brand"
            onClick={() => void roomActions.handleCheckIn(reservation)}
            isDisabled={reservation.room === null || !detail.checkInEligible || saving || loading}
          >
            {t('reservations.room.checkIn')}
          </Button>
        </HStack>
        {reservation.room === null && (
          <Text fontSize="xs" color="textSecondary" mt={2}>
            {t('reservations.room.assignToEnable')}
          </Text>
        )}
        {reservation.room !== null && !detail.checkInEligible && (
          <Text fontSize="xs" color="textSecondary" mt={2}>
            {t('reservations.room.checkInFromArrival')}
          </Text>
        )}
      </Box>
    </>
  );
}

export function DetailHistory({ entries }: { entries: ReservationHistoryEntry[] }) {
  const { t, locale } = useI18n();
  return (
    <Box>
      <Text fontWeight="semibold" mb={2}>
        {t('reservations.detail.history')}
      </Text>
      <QueryFeedback
        loading={false}
        error={null}
        isEmpty={entries.length === 0}
        emptyText={t('reservations.detail.historyEmpty')}
      >
        <Stack spacing={2} maxH="320px" overflowY="auto">
          {entries.map((entry) => (
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
  );
}
