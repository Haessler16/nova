'use client';

import { Box, Stack, Text, Textarea } from '@chakra-ui/react';
import { ActionDialog } from '@/components/action-dialog';
import { useI18n } from '@/lib/i18n';
import type { Reservation } from '@/lib/types';
import type { ReservationCancelController } from '../_hooks/use-reservation-cancel';

function cancelSummary(
  t: ReturnType<typeof useI18n>['t'],
  reservation: Reservation | null,
  today: string,
): string {
  if (reservation === null) {
    return t('reservations.cancel.summaryEmpty');
  }
  const base =
    reservation.checkInDate <= today && reservation.checkOutDate > today
      ? t('reservations.cancel.summaryActive', {
          roomType: reservation.roomType.name,
          code: reservation.code,
        })
      : t('reservations.cancel.summaryFuture', {
          roomType: reservation.roomType.name,
          code: reservation.code,
        });
  const room =
    reservation.room !== null
      ? ` ${t('reservations.cancel.summaryRoom', { number: reservation.room.number })}`
      : '';
  return base + room;
}

export function CancelReservationDialog({
  cancel,
  reservation,
  today,
}: {
  cancel: ReservationCancelController;
  reservation: Reservation | null;
  today: string;
}) {
  const { t } = useI18n();

  return (
    <ActionDialog
      isOpen={cancel.modal.isOpen}
      onClose={cancel.close}
      tone={reservation?.status === 'CHECKED_IN' ? 'critical' : 'warning'}
      title={t('reservations.cancel.title')}
      summary={cancelSummary(t, reservation, today)}
      confirmLabel={t('reservations.cancel.title')}
      hasUnsavedChanges={cancel.reason.trim().length > 0}
      isLoading={cancel.saving}
      error={cancel.apiError ?? undefined}
      onConfirm={() => void cancel.submit()}
    >
      <Stack spacing={3}>
        <Box>
          <Text fontSize="xs" color="textSecondary" textTransform="uppercase" mb={1}>
            {t('reservations.cancel.reasonLabel')}
          </Text>
          <Textarea
            value={cancel.reason}
            onChange={(event) => cancel.setReason(event.target.value)}
            placeholder={t('reservations.cancel.reasonPlaceholder')}
            maxLength={500}
            rows={3}
          />
          {cancel.errors.reason !== undefined && (
            <Text fontSize="xs" color="danger.500" mt={1}>
              {cancel.errors.reason}
            </Text>
          )}
        </Box>
        <Text fontSize="xs" color="textSecondary">
          {t('reservations.cancel.irreversible')}
        </Text>
      </Stack>
    </ActionDialog>
  );
}
