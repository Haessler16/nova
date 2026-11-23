'use client';

import { useDisclosure, useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { CheckoutReadiness, Reservation, Stay } from '@/lib/types';
import type { Tenant } from '../_lib/front-office.types';

export function useCheckout({
  tenant,
  reloadAll,
  setBusy,
}: {
  tenant: Tenant;
  reloadAll: () => void;
  setBusy: (key: string | null) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const modal = useDisclosure();
  const [target, setTarget] = useState<Stay | null>(null);
  const [notes, setNotes] = useState('');
  const [readiness, setReadiness] = useState<CheckoutReadiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [allowBalance, setAllowBalance] = useState(false);
  const [balanceReason, setBalanceReason] = useState('');

  function open(stay: Stay): void {
    setTarget(stay);
    setNotes('');
    setReadiness(null);
    setError(null);
    setAllowBalance(false);
    setBalanceReason('');
    modal.onOpen();
    setLoading(true);
    void api<CheckoutReadiness>(`/api/v1/front-office/stays/${stay.id}/checkout-readiness`, {
      tenant,
    })
      .then((payload) => setReadiness(payload))
      .catch((cause: unknown) => setError(cause))
      .finally(() => setLoading(false));
  }

  async function confirm(): Promise<void> {
    if (target === null) {
      return;
    }
    const current = target;
    const body: {
      notes?: string;
      allowOutstandingBalance?: boolean;
      balanceReason?: string;
    } = {};
    if (notes.trim() !== '') {
      body.notes = notes.trim();
    }
    if (allowBalance) {
      if (balanceReason.trim().length < 3) {
        toast({
          title: t('frontOffice.checkout.balanceTitle'),
          description: t('frontOffice.checkout.balanceHelp'),
          status: 'warning',
        });
        return;
      }
      body.allowOutstandingBalance = true;
      body.balanceReason = balanceReason.trim();
    }
    setBusy(`check-out:${current.id}`);
    try {
      await api(`/api/v1/front-office/stays/${current.id}/check-out`, {
        method: 'POST',
        tenant,
        body,
      });
      toast({
        title: t('frontOffice.checkout.success', { name: current.guest.fullName }),
        status: 'success',
      });
      modal.onClose();
      reloadAll();
    } catch (cause) {
      // Matches the shared run() helper: mutation failures surface as a toast,
      // while `error` stays reserved for the readiness fetch shown in the dialog.
      toast({
        title: t('frontOffice.error.generic'),
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setBusy(null);
    }
  }

  return {
    modal,
    target,
    notes,
    setNotes,
    readiness,
    loading,
    error,
    allowBalance,
    setAllowBalance,
    balanceReason,
    setBalanceReason,
    open,
    confirm,
  };
}

export function useNoShow({
  tenant,
  reloadAll,
  setBusy,
}: {
  tenant: Tenant;
  reloadAll: () => void;
  setBusy: (key: string | null) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const modal = useDisclosure();
  const [target, setTarget] = useState<Reservation | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);

  function open(reservation: Reservation): void {
    setTarget(reservation);
    setReason('');
    setError(null);
    modal.onOpen();
  }

  async function confirm(): Promise<void> {
    if (target === null) {
      return;
    }
    const current = target;
    setBusy(`no-show:${current.id}`);
    setError(null);
    try {
      await api(`/api/v1/front-office/reservations/${current.id}/no-show`, {
        method: 'POST',
        tenant,
        body: {
          ...(reason.trim().length >= 3 ? { reason: reason.trim() } : {}),
        },
      });
      toast({ title: t('frontOffice.noShow.success'), status: 'success' });
      modal.onClose();
      reloadAll();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(null);
    }
  }

  return { modal, target, reason, setReason, error, open, confirm };
}

export type CheckoutController = ReturnType<typeof useCheckout>;
export type NoShowController = ReturnType<typeof useNoShow>;
