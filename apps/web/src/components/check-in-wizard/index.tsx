'use client';

import {
  Alert,
  AlertDescription,
  AlertIcon,
  Divider,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Stack,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import type { TenantSelection } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Reservation } from '@/lib/types';
import { CheckInFooter } from './check-in-footer';
import { CheckInSteps } from './check-in-steps';
import { CheckInStepper } from './check-in-stepper';
import { useCheckInData } from './lib/use-check-in-data';
import { useCheckInLease } from './lib/use-check-in-lease';
import { useCheckInActions } from './lib/use-check-in-submit';
import { useCheckInView } from './lib/use-check-in-view';

export function CheckInWizard({
  isOpen,
  reservation,
  tenant,
  onClose,
  onCompleted,
}: {
  isOpen: boolean;
  reservation: Reservation | null;
  tenant: TenantSelection;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const { readiness, party, instructions, relevantInstructions, bumpVersion } = useCheckInData({
    isOpen,
    reservation,
    tenant,
  });
  const { actor, roomId, roomBusyId, selectRoom, releaseHeldLease } = useCheckInLease({
    isOpen,
    reservation,
    tenant,
    onReadinessReload: readiness.reload,
  });

  useEffect(() => {
    if (isOpen) setStep(0);
  }, [isOpen, reservation?.id]);

  const view = useCheckInView({ readiness, party, relevantInstructions, roomId, t });

  async function handleClose(): Promise<void> {
    await releaseHeldLease();
    onClose();
  }

  const { busy, instructionBusyId, acknowledgeInstruction, handleContinue, handleConfirm } =
    useCheckInActions({
      reservation,
      tenant,
      step,
      setStep,
      selectedRoom: view.selectedRoom,
      windowBlocked: view.windowBlocked,
      windowMessage: view.windowMessage,
      bumpVersion,
      releaseHeldLease,
      onReadinessReload: readiness.reload,
      onInstructionsReload: instructions.reload,
      onCompleted,
      onClose,
    });

  const stepLabels = [
    t('checkIn.step.reservation'),
    t('checkIn.step.room'),
    t('checkIn.step.party'),
    t('checkIn.step.confirm'),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => void handleClose()}
      size="xl"
      closeOnOverlayClick={false}
      closeOnEsc={busy === null}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {t('checkIn.header', {
            name: reservation?.guest.fullName ?? t('checkIn.guestFallback'),
          })}
        </ModalHeader>
        <ModalCloseButton isDisabled={busy !== null} />
        <ModalBody maxH="70vh" overflowY="auto">
          <Stack spacing={4}>
            <CheckInStepper labels={stepLabels} step={step} />
            <Divider />

            {view.windowMessage !== null && (
              <Alert status="warning" borderRadius="md" alignItems="flex-start">
                <AlertIcon />
                <AlertDescription fontSize="sm">{view.windowMessage}</AlertDescription>
              </Alert>
            )}

            <CheckInSteps
              step={step}
              reservation={reservation}
              readiness={readiness}
              party={party}
              instructions={instructions}
              partyData={party.data ?? null}
              partyMembers={view.partyMembers}
              partyBlocked={view.partyBlocked}
              relevantInstructions={relevantInstructions}
              instructionBusyId={instructionBusyId}
              rooms={view.rooms}
              selectedRoomId={view.selectedRoomId}
              selectedRoom={view.selectedRoom}
              roomBusyId={roomBusyId}
              actorId={actor?.id}
              unreadInstructions={view.unreadInstructions}
              onAcknowledge={(instruction) => void acknowledgeInstruction(instruction)}
              onSelectRoom={(room) => void selectRoom(room)}
            />
          </Stack>
        </ModalBody>
        <CheckInFooter
          step={step}
          busy={busy}
          windowBlocked={view.windowBlocked}
          roomBusyId={roomBusyId}
          selectedRoom={view.selectedRoom}
          partyBlocked={view.partyBlocked}
          onClose={() => void handleClose()}
          onBack={() => setStep((current) => Math.max(0, current - 1))}
          onContinue={() => void handleContinue()}
          onConfirm={() => void handleConfirm()}
        />
      </ModalContent>
    </Modal>
  );
}
