'use client';

import { useDisclosure, useToast } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Role } from '@/lib/types';
import type { AdminTenant } from '../_lib/admin';

export function useRoleEditor(tenant: AdminTenant, reload: () => void) {
  const { t } = useI18n();
  const toast = useToast();
  const modal = useDisclosure();

  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState({ key: '', name: '', permissions: [] as string[] });
  const [saving, setSaving] = useState(false);

  function openCreate(): void {
    setEditing(null);
    setForm({ key: '', name: '', permissions: [] });
    modal.onOpen();
  }

  function openEdit(role: Role): void {
    setEditing(role);
    setForm({ key: role.key, name: role.name, permissions: role.permissions });
    modal.onOpen();
  }

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing === null) {
        await api<Role>('/api/v1/admin/roles', {
          method: 'POST',
          tenant,
          body: {
            key: form.key.trim(),
            name: form.name.trim(),
            permissions: form.permissions,
          },
        });
        toast({ title: t('admin.roleEditor.toastCreated'), status: 'success' });
      } else {
        await api<Role>(`/api/v1/admin/roles/${editing.id}`, {
          method: 'PATCH',
          tenant,
          body: { name: form.name.trim(), permissions: form.permissions },
        });
        toast({ title: t('admin.roleEditor.toastUpdated'), status: 'success' });
      }
      modal.onClose();
      reload();
    } catch (cause) {
      toast({
        title: t('admin.roleEditor.toastError'),
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  return { modal, editing, form, setForm, saving, openCreate, openEdit, save };
}

export type RoleEditor = ReturnType<typeof useRoleEditor>;
