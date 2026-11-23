'use client';

import { Badge, HStack, Stack, Text } from '@chakra-ui/react';
import { ActionDialog } from '@/components/action-dialog';
import { useI18n } from '@/lib/i18n';
import type { RoomMoveController } from '../_hooks/use-room-move';
import { roomMoveErrorMessage } from '../_lib/front-office.types';
import { RoomMoveBody } from './room-move-body';

export function RoomMoveDialog({ move, busy }: { move: RoomMoveController; busy: string | null }) {
  const { t } = useI18n();

  return (
    <ActionDialog
      isOpen={move.modal.isOpen}
      onClose={move.modal.onClose}
      size="4xl"
      tone="info"
      title={t('frontOffice.move.title')}
      summary={move.result !== null ? t('frontOffice.move.summaryDone') : t('frontOffice.move.summary')}
      confirmLabel={move.result !== null ? t('frontOffice.move.close') : t('frontOffice.move.confirm')}
      hideCancel={move.result !== null}
      hasUnsavedChanges={move.reason.trim() !== ''}
      error={move.actionError === null ? undefined : roomMoveErrorMessage(move.actionError, t)}
      onConfirm={move.result !== null ? move.modal.onClose : () => void move.submit()}
      isLoading={busy === `move:${move.target?.id ?? ''}`}
      confirmDisabled={move.result === null && (move.roomId === '' || move.loading)}
    >
      {move.result !== null ? (
        <Stack spacing={3} align="center" py={8}>
          <Badge colorScheme="mint">{t('frontOffice.move.doneBadge')}</Badge>
          <Text fontWeight="semibold">{t('frontOffice.move.doneTitle')}</Text>
          <HStack fontSize="xl" fontWeight="bold" spacing={3}>
            <Text>{t('frontOffice.rack.room', { number: move.result.fromNumber })}</Text>
            <Text color="gray.400">→</Text>
            <Text>{t('frontOffice.rack.room', { number: move.result.toNumber })}</Text>
          </HStack>
          <Text fontSize="sm" color="gray.600" textAlign="center" maxW="380px">
            {t('frontOffice.move.doneNote')}
          </Text>
        </Stack>
      ) : (
        <RoomMoveBody move={move} />
      )}
    </ActionDialog>
  );
}
