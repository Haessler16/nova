'use client';

import { useState, type FormEvent } from 'react';
import { useToast } from '@chakra-ui/react';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Guest, ReservationParty as ReservationPartyResponse } from '@/lib/types';
import { buildPartyPayload, validatePartyForm } from './party-editor-payload';
import { formFromMember, type EditorForm, type EditorState } from './party-utils';

export function usePartyEditorForm({
  editor,
  party,
  reservationId,
  checkInDate,
  onSaved,
}: {
  editor: EditorState;
  party: ReservationPartyResponse;
  reservationId: string;
  checkInDate: string;
  onSaved: () => void;
}) {
  const { tenant } = useSession();
  const toast = useToast();
  const { t } = useI18n();
  const editing = editor.member !== null;
  const [form, setForm] = useState<EditorForm>(() => formFromMember(editor, party));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  function patch(next: Partial<EditorForm>): void {
    setForm((current) => ({ ...current, ...next }));
  }

  function selectExistingGuest(guest: Guest): void {
    patch({
      guestId: guest.id,
      fullName: guest.fullName,
      email: guest.email ?? '',
      phone: guest.phone ?? '',
      documentType: guest.documentType ?? '',
      documentNumber: guest.documentNumber ?? '',
    });
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setFormError('');
    const error = validatePartyForm(t, editor, form, checkInDate);
    if (error !== null) {
      setFormError(error);
      return;
    }

    setSaving(true);
    try {
      const path = editing
        ? `/api/v1/reservations/${reservationId}/party/${editor.member?.reservationGuestId}`
        : `/api/v1/reservations/${reservationId}/party`;
      await api<ReservationPartyResponse>(path, {
        method: editing ? 'PATCH' : 'POST',
        tenant,
        body: buildPartyPayload(editor, form, editing),
      });
      toast({
        title: editing ? t('party.toast.updated') : t('party.toast.added'),
        status: 'success',
      });
      onSaved();
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return { form, patch, selectExistingGuest, formError, saving, submit, editing };
}
