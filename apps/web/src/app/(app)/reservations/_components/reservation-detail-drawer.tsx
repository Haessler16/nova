'use client';

import {
  Box,
  Divider,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Stack,
  Text,
} from '@chakra-ui/react';
import { QueryFeedback } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Guest } from '@/lib/types';
import type { ReservationDetailController } from '../_hooks/use-reservation-detail';
import type { ReservationRoomActions } from '../_hooks/use-reservation-room-actions';
import { DetailHistory, DetailOverview, DetailRoomAssignment } from './detail-sections';

export function ReservationDetailDrawer({
  detail,
  roomActions,
  onEditGuest,
}: {
  detail: ReservationDetailController;
  roomActions: ReservationRoomActions;
  onEditGuest: (guest: Guest) => void;
}) {
  const { t } = useI18n();
  const reservation = detail.selectedReservation;

  return (
    <Drawer
      isOpen={detail.drawer.isOpen}
      placement="right"
      onClose={detail.drawer.onClose}
      size="lg"
    >
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>
          {t('reservations.detail.title', { code: reservation?.code ?? '' })}
          {reservation !== null && (
            <Text fontSize="sm" fontWeight="normal" color="textSecondary">
              {reservation.guest.fullName}
            </Text>
          )}
        </DrawerHeader>
        <DrawerBody pb={10}>
          <QueryFeedback
            loading={detail.detail.loading}
            error={detail.detail.error}
            onRetry={detail.detail.reload}
            isEmpty={reservation === null}
            emptyText={t('reservations.detail.empty')}
          >
            {reservation !== null && (
              <Stack spacing={5}>
                <DetailOverview
                  reservation={reservation}
                  guest={detail.detailGuest}
                  onEditGuest={onEditGuest}
                  onChanged={detail.bumpDetail}
                />

                {reservation.status === 'CONFIRMED' && (
                  <DetailRoomAssignment
                    reservation={reservation}
                    detail={detail}
                    roomActions={roomActions}
                  />
                )}

                {reservation.cancellationReason !== null && (
                  <Box>
                    <Text fontSize="xs" color="textSecondary" textTransform="uppercase">
                      {t('reservations.detail.cancelReason')}
                    </Text>
                    <Text fontSize="sm">{reservation.cancellationReason}</Text>
                    <Text fontSize="xs" color="textSecondary">
                      {formatDateTime(reservation.cancelledAt)}
                    </Text>
                  </Box>
                )}

                <Divider />
                <DetailHistory entries={detail.detail.data?.history ?? []} />
              </Stack>
            )}
          </QueryFeedback>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
