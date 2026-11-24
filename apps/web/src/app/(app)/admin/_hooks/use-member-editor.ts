'use client';

import { useDisclosure, useToast } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Membership, Role } from '@/lib/types';
import type { AdminTenant } from '../_lib/admin';

export function useMemberEditor(
  tenant: AdminTenant,
  roles: Role[] | undefined,
  reload: () => void,
) {
  const { t } = useI18n();
  const toast = useToast();
  const modal = useDisclosure();

  const [editing, setEditing] = useState<Membership | null>(null);
  const [form, setForm] = useState({
    email: '',
    name: '',
    roleId: '',
    status: 'ACTIVE',
  });
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openCreate(): void {
    setEditing(null);
    setInvitationToken(null);
    setForm({
      email: '',
      name: '',
      roleId: roles?.find((role) => role.key === 'RECEPTION')?.id ?? '',
      status: 'ACTIVE',
    });
    modal.onOpen();
  }

  function openEdit(member: Membership): void {
    setEditing(member);
    setInvitationToken(null);
    setForm({
      email: member.user.email,
      name: member.user.name,
      roleId: member.roleId ?? '',
      status: member.status,
    });
    modal.onOpen();
  }

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing === null) {
        const result = await api<{
          membership: unknown;
          invitation?: { token?: string; expiresAt: string };
        }>('/api/v1/admin/memberships', {
          method: 'POST',
          tenant,
          body: {
            email: form.email.trim(),
            ...(form.name.trim() !== '' ? { name: form.name.trim() } : {}),
            ...(form.roleId !== '' ? { roleId: form.roleId } : {}),
          },
        });
        setInvitationToken(result.invitation?.token ?? null);
        toast({ title: t('admin.memberEditor.toastCreated'), status: 'success' });
        reload();
      } else {
        await api<unknown>(`/api/v1/admin/memberships/${editing.id}`, {
          method: 'PATCH',
          tenant,
          body: {
            status: form.status as 'ACTIVE' | 'SUSPENDED' | 'DISABLED',
            ...(form.roleId !== '' ? { roleId: form.roleId } : {}),
          },
        });
        toast({ title: t('admin.memberEditor.toastUpdated'), status: 'success' });
        modal.onClose();
        reload();
      }
    } catch (cause) {
      toast({
        title: t('admin.memberEditor.toastError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  return { modal, editing, form, setForm, invitationToken, saving, openCreate, openEdit, save };
}

export type MemberEditor = ReturnType<typeof useMemberEditor>;
