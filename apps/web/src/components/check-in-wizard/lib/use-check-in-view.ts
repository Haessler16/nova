'use client';

import type { useI18n } from '@/lib/i18n';
import type {
  CheckInReadiness,
  CheckInRoomOption,
  ReservationInstruction,
  ReservationParty,
  ReservationPartyMember,
} from '@/lib/types';
import { blockedWindowMessage } from './check-in-labels';

export function useCheckInView({
  readiness,
  party,
  relevantInstructions,
  roomId,
  t,
}: {
  readiness: { data: CheckInReadiness | null };
  party: { data: ReservationParty | null };
  relevantInstructions: ReservationInstruction[];
  roomId: string;
  t: ReturnType<typeof useI18n>['t'];
}) {
  const rooms: CheckInRoomOption[] = readiness.data?.rooms ?? [];
  const selectedRoomId = roomId !== '' ? roomId : (readiness.data?.currentRoomId ?? '');
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const partyMembers: ReservationPartyMember[] =
    party.data === null
      ? []
      : [party.data.primary, ...party.data.companions].filter(
          (member): member is ReservationPartyMember => member !== null,
        );
  const partyBlocked = party.data?.readiness.checkIn === 'BLOCKED';
  const checkInWindow = readiness.data?.checkInWindow ?? null;
  const windowMessage =
    checkInWindow !== null && !checkInWindow.allowed
      ? blockedWindowMessage(checkInWindow, t)
      : null;

  return {
    rooms,
    selectedRoomId,
    selectedRoom,
    partyMembers,
    partyBlocked,
    windowMessage,
    windowBlocked: windowMessage !== null,
    unreadInstructions: relevantInstructions.filter((instruction) => instruction.status === 'NEW')
      .length,
  };
}
