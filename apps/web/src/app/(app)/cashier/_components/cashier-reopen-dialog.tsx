'use client';

import { Stack, Text, Textarea } from '@chakra-ui/react';
import { ActionDialog } from '@/components/action-dialog';
import { Field } from '@/components/ui';
import { formatCalendarDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { CashierReopen } from '../_hooks/use-cashier-reopen';

export function CashierReopenDialog({ reopen }: { reopen: CashierReopen }) {
  const { t } = useI18n();

  return (
    <ActionDialog
      isOpen={reopen.modal.isOpen}
      onClose={reopen.close}
      tone="critical"
      title={t('cashier.reopen.title')}
      summary={
        reopen.target === null
          ? t('cashier.reopen.summaryEmpty')
          : t('cashier.reopen.summary', {
              date: formatCalendarDate(reopen.target.operationalDate),
            })
      }
      confirmLabel={t('cashier.reopen.confirm')}
      hasUnsavedChanges={reopen.reason.trim().length > 0}
      isLoading={reopen.saving}
      error={reopen.apiError ?? undefined}
      onConfirm={() => void reopen.submit()}
    >
      <Stack spacing={3}>
        <Field label={t('cashier.reopen.reason')} isRequired error={reopen.errors['reopen.reason']}>
          <Textarea
            value={reopen.reason}
            onChange={(event) => reopen.setReason(event.target.value)}
            maxLength={500}
            rows={3}
            required
          />
        </Field>
        <Text fontSize="xs" color="textSecondary">
          {t('cashier.reopen.hint')}
        </Text>
      </Stack>
    </ActionDialog>
  );
}
