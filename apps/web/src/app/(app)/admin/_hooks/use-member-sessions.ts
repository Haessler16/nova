'use client';

import { useDisclosure, useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Membership, SessionSummary } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import type { AdminTenant } from '../_lib/admin';

export function useMemberSessions(tenant: AdminTenant) {
  const { t } = useI18n();
  const toast = useToast();
  const modal = useDisclosure();

  const [member, setMember] = useState<Membership | null>(null);
  const sessions = useAsyncData<{ items: SessionSummary[] }>(
    () =>
      member === null
        ? Promise.resolve({ items: [] })
        : api<{ items: SessionSummary[] }>(`/api/v1/admin/memberships/${member.id}/sessions`, {
            tenant,
          }),
    `admin:sessions:${member?.id ?? 'none'}`,
  );

  function open(target: Membership): void {
    setMember(target);
    modal.onOpen();
  }

  async function revoke(session: SessionSummary): Promise<void> {
    if (member === null) {
      return;
    }
    try {
      await api<void>(`/api/v1/admin/memberships/${member.id}/sessions/${session.id}`, {
        method: 'DELETE',
        tenant,
      });
      toast({ title: t('admin.sessions.toastRevoked'), status: 'success' });
      sessions.reload();
    } catch (cause) {
      toast({
        title: t('admin.sessions.toastError'),
        description: errorMessage(cause),
        status: 'error',
      });
    }
  }

  return { modal, member, sessions, open, revoke };
}

export type MemberSessions = ReturnType<typeof useMemberSessions>;
