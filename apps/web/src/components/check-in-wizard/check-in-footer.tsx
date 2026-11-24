'use client';

import { Button, ModalFooter } from '@chakra-ui/react';
import { useI18n } from '@/lib/i18n';
import type { CheckInRoomOption } from '@/lib/types';

export function CheckInFooter({
  step,
  busy,
  windowBlocked,
  roomBusyId,
  selectedRoom,
  partyBlocked,
  onClose,
  onBack,
  onContinue,
  onConfirm,
}: {
  step: number;
  busy: string | null;
  windowBlocked: boolean;
  roomBusyId: string | null;
  selectedRoom: CheckInRoomOption | null;
  partyBlocked: boolean;
  onClose: () => void;
  onBack: () => void;
  onContinue: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();

  return (
    <ModalFooter>
      <Button variant="ghost" mr={3} onClick={onClose} isDisabled={busy !== null}>
        {t('common.cancel')}
      </Button>
      <Button variant="outline" mr={3} onClick={onBack} isDisabled={step === 0 || busy !== null}>
        {t('checkIn.action.back')}
      </Button>
      {step < 3 ? (
        <Button
          colorScheme="brand"
          onClick={onContinue}
          isLoading={busy === 'assign-room'}
          isDisabled={
            windowBlocked ||
            roomBusyId !== null ||
            (step === 1 && (selectedRoom === null || !selectedRoom.eligible))
          }
        >
          {t('checkIn.action.continue')}
        </Button>
      ) : (
        <Button
          colorScheme="brand"
          onClick={onConfirm}
          isLoading={busy === 'check-in'}
          isDisabled={
            windowBlocked || partyBlocked || selectedRoom === null || !selectedRoom.eligible
          }
        >
          {t('checkIn.action.confirm')}
        </Button>
      )}
    </ModalFooter>
  );
}
