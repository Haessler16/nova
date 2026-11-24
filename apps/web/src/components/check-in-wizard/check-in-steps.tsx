'use client';

import type {
  CheckInReadiness,
  CheckInRoomOption,
  Reservation,
  ReservationInstruction,
  ReservationParty,
  ReservationPartyMember,
} from '@/lib/types';
import { StepConfirm } from './step-confirm';
import { StepParty } from './step-party';
import { StepReservation } from './step-reservation';
import { StepRoom } from './step-room';

export function CheckInSteps({
  step,
  reservation,
  readiness,
  party,
  instructions,
  partyData,
  partyMembers,
  partyBlocked,
  relevantInstructions,
  instructionBusyId,
  rooms,
  selectedRoomId,
  selectedRoom,
  roomBusyId,
  actorId,
  unreadInstructions,
  onAcknowledge,
  onSelectRoom,
}: {
  step: number;
  reservation: Reservation | null;
  readiness: {
    loading: boolean;
    error: unknown | null;
    reload: () => void;
    data: CheckInReadiness | null;
  };
  party: {
    loading: boolean;
    error: unknown | null;
    reload: () => void;
    data: ReservationParty | null;
  };
  instructions: {
    loading: boolean;
    error: unknown | null;
    reload: () => void;
  };
  partyData: ReservationParty | null;
  partyMembers: ReservationPartyMember[];
  partyBlocked: boolean;
  relevantInstructions: ReservationInstruction[];
  instructionBusyId: string | null;
  rooms: CheckInRoomOption[];
  selectedRoomId: string;
  selectedRoom: CheckInRoomOption | null;
  roomBusyId: string | null;
  actorId: string | undefined;
  unreadInstructions: number;
  onAcknowledge: (instruction: ReservationInstruction) => void;
  onSelectRoom: (room: CheckInRoomOption) => void;
}) {
  if (step === 0 && reservation !== null) {
    return (
      <StepReservation
        reservation={reservation}
        instructions={instructions}
        relevantInstructions={relevantInstructions}
        instructionBusyId={instructionBusyId}
        onAcknowledge={onAcknowledge}
      />
    );
  }

  if (step === 1) {
    return (
      <StepRoom
        readiness={readiness}
        rooms={rooms}
        selectedRoomId={selectedRoomId}
        roomTypeName={reservation?.roomType.name}
        actorId={actorId}
        roomBusyId={roomBusyId}
        onSelectRoom={onSelectRoom}
      />
    );
  }

  if (step === 2) {
    return (
      <StepParty
        reservation={reservation}
        party={party}
        partyMembers={partyMembers}
        partyBlocked={partyBlocked}
      />
    );
  }

  if (step === 3 && reservation !== null) {
    return (
      <StepConfirm
        reservation={reservation}
        selectedRoom={selectedRoom}
        party={partyData}
        partyBlocked={partyBlocked}
        unreadInstructions={unreadInstructions}
      />
    );
  }

  return null;
}
