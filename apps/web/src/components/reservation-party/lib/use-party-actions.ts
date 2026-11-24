'use client';

import { useState } from 'react';
import { useToast } from '@chakra-ui/react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type {
  ReservationParty as ReservationPartyResponse,
  ReservationPartyMember,
} from '@/lib/types';

export function usePartyActions({
  reservationId,
  onChanged,
}: {
  reservationId: string;
  onChanged?: () => void;
}) {
  const { tenant } = useSession();
  const toast = useToast();
  const { t } = useI18n();
  const [version, setVersion] = useState(0);
  const [removingId, setRemovingId] = useState<string | null>(null);

  function reload(): void {
    setVersion((current) => current + 1);
    onChanged?.();
  }

  async function removeMember(member: ReservationPartyMember): Promise<void> {
    if (member.reservationGuestId === null) return;
    if (!window.confirm(t('party.confirm.remove', { name: member.fullName }))) return;
    setRemovingId(member.reservationGuestId);
    try {
      await api<ReservationPartyResponse>(
        `/api/v1/reservations/${reservationId}/party/${member.reservationGuestId}`,
        { method: 'DELETE', tenant },
      );
      toast({ title: t('party.toast.removed', { name: member.fullName }), status: 'success' });
      reload();
    } catch (cause) {
      toast({
        title: t('party.toast.removeError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setRemovingId(null);
    }
  }

  return { version, reload, removingId, removeMember };
}
