'use client';

import { useDisclosure, useToast } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { Membership } from '@/lib/types';
import type { AdminTenant } from '../_lib/admin';

export function usePropertyAssignment(tenant: AdminTenant, reload: () => void) {
  const toast = useToast();
  const modal = useDisclosure();

  const [member, setMember] = useState<Membership | null>(null);
  const [form, setForm] = useState({ propertyId: '', roleId: '' });
  const [saving, setSaving] = useState(false);

  function open(target: Membership): void {
    setMember(target);
    setForm({ propertyId: '', roleId: '' });
    modal.onOpen();
  }

  async function add(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (member === null) {
      return;
    }
    if (form.propertyId === '' || form.roleId === '') {
      toast({ title: 'Elegí propiedad y rol', status: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await api<unknown>(`/api/v1/admin/properties/${form.propertyId}/memberships`, {
        method: 'POST',
        tenant,
        body: { userId: member.userId, roleId: form.roleId },
      });
      toast({ title: 'Asignación creada', status: 'success' });
      modal.onClose();
      reload();
    } catch (cause) {
      toast({
        title: 'No se pudo asignar',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  return { modal, member, form, setForm, saving, open, add };
}

export type PropertyAssignment = ReturnType<typeof usePropertyAssignment>;
