'use client';

import { Stack, Text, Textarea } from '@chakra-ui/react';
import { ActionDialog } from '@/components/action-dialog';
import { Field } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { CheckoutController } from '../_hooks/use-stay-flows';
import { CheckoutSummary } from './checkout-summary';

export function CheckoutDialog({
  checkout,
  busy,
  fallbackCurrency,
}: {
  checkout: CheckoutController;
  busy: string | null;
  fallbackCurrency: string;
}) {
  const { t } = useI18n();

  return (
    <ActionDialog
      isOpen={checkout.modal.isOpen}
      onClose={checkout.modal.onClose}
      tone="critical"
      title={t('frontOffice.checkout.title')}
      summary={t('frontOffice.checkout.summary')}
      confirmLabel={t('frontOffice.checkout.confirm')}
      onConfirm={() => void checkout.confirm()}
      isLoading={busy?.startsWith('check-out') === true}
      hasUnsavedChanges={
        checkout.notes.trim() !== '' || checkout.balanceReason.trim() !== ''
      }
      error={checkout.error === null ? undefined : errorMessage(checkout.error)}
    >
      {checkout.target !== null && (
        <Stack spacing={3}>
          <Text fontSize="sm">
            {checkout.target.guest.fullName} · Hab. {checkout.target.room.number} ·{' '}
            {checkout.target.reservation.code}
          </Text>

          {checkout.loading && (
            <Text fontSize="sm" color="gray.500">
              {t('frontOffice.checkout.loading')}
            </Text>
          )}
          {checkout.readiness !== null && (
            <CheckoutSummary
              readiness={checkout.readiness}
              fallbackCurrency={fallbackCurrency}
              allowBalance={checkout.allowBalance}
              onAllowBalanceChange={checkout.setAllowBalance}
              balanceReason={checkout.balanceReason}
              onBalanceReasonChange={checkout.setBalanceReason}
            />
          )}
          <Field
            label={t('frontOffice.checkout.notes')}
            helper={t('frontOffice.checkout.notesHelper')}
          >
            <Textarea
              rows={3}
              value={checkout.notes}
              maxLength={2000}
              onChange={(event) => checkout.setNotes(event.target.value)}
            />
          </Field>
        </Stack>
      )}
    </ActionDialog>
  );
}
