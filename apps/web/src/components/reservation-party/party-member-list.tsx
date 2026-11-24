'use client';

import { Divider, Stack } from '@chakra-ui/react';
import type { ReservationPartyMember } from '@/lib/types';
import { PartyMemberRow } from './party-member-row';

export function PartyMemberList({
  members,
  editable,
  removingId,
  onEdit,
  onRemove,
}: {
  members: ReservationPartyMember[];
  editable: boolean;
  removingId: string | null;
  onEdit: (member: ReservationPartyMember) => void;
  onRemove: (member: ReservationPartyMember) => void;
}) {
  return (
    <Stack spacing={2} divider={<Divider />}>
      {members.map((member) => (
        <PartyMemberRow
          key={member.reservationGuestId ?? member.guestId}
          member={member}
          editable={editable && member.reservationGuestId !== null}
          removing={removingId === member.reservationGuestId}
          onEdit={() => onEdit(member)}
          onRemove={() => onRemove(member)}
        />
      ))}
    </Stack>
  );
}
