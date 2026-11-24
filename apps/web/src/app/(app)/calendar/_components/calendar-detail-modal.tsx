'use client';

import {
  Badge,
  Button,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import { KeyValue, StatusBadge } from '@/components/ui';
import {
  RESERVATION_STATUS_COLORS,
  formatCalendarDate,
  reservationStatusLabel,
} from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Reservation } from '@/lib/types';

export function CalendarDetailModal({
  reservation,
  isOpen,
  onClose,
}: {
  reservation: Reservation | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader fontSize="md">
          {reservation?.code} · {reservation?.guest.fullName}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {reservation !== null && (
            <Stack spacing={4}>
              <HStack>
                <StatusBadge
                  color={RESERVATION_STATUS_COLORS[reservation.status]}
                  label={reservationStatusLabel(locale, reservation.status)}
                />
                <Badge colorScheme="brand" textTransform="none">
                  {t('calendar.detail.room', {
                    number: reservation.room?.number ?? t('calendar.detail.unassigned'),
                  })}
                </Badge>
              </HStack>
              <SimpleGrid columns={2} spacing={3}>
                <KeyValue
                  label={t('calendar.detail.checkIn')}
                  value={formatCalendarDate(reservation.checkInDate)}
                />
                <KeyValue
                  label={t('calendar.detail.checkOut')}
                  value={formatCalendarDate(reservation.checkOutDate)}
                />
                <KeyValue label={t('calendar.detail.nights')} value={reservation.nights} />
                <KeyValue label={t('calendar.detail.type')} value={reservation.roomType.name} />
                <KeyValue
                  label={t('calendar.detail.occupancy')}
                  value={t('calendar.detail.occupancyValue', {
                    adults: reservation.adults,
                    children: reservation.children,
                  })}
                />
                <KeyValue
                  label={t('calendar.detail.source')}
                  value={reservation.source ?? t('calendar.detail.direct')}
                />
              </SimpleGrid>
              {reservation.notes !== null && (
                <Text fontSize="sm" color="gray.600" whiteSpace="pre-wrap">
                  {reservation.notes}
                </Text>
              )}
              <HStack>
                <Button as={NextLink} href="/reservations" size="sm" colorScheme="brand">
                  {t('calendar.detail.open')}
                </Button>
                <Button size="sm" variant="ghost" onClick={onClose}>
                  {t('calendar.detail.close')}
                </Button>
              </HStack>
            </Stack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
