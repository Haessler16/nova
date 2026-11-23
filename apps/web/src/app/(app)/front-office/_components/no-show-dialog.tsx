'use client';

import { Stack, Text, Textarea } from '@chakra-ui/react';
import { ActionDialog } from '@/components/action-dialog';
import { Field } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatCalendarDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { NoShowController } from '../_hooks/use-stay-flows';

export function NoShowDialog({ noShow, busy }: { noShow: NoShowController; busy: string | null }) {
  const { t } = useI18n();

  return (
    <ActionDialog
      isOpen={noShow.modal.isOpen}
      onClose={noShow.modal.onClose}
      tone="warning"
      title={t('frontOffice.noShow.title')}
      summary={t('frontOffice.noShow.summary')}
      confirmLabel={t('frontOffice.noShow.confirm')}
      onConfirm={() => void noShow.confirm()}
      isLoading={busy?.startsWith('no-show') === true}
      hasUnsavedChanges={noShow.reason.trim() !== ''}
      error={noShow.error === null ? undefined : errorMessage(noShow.error)}
    >
      {noShow.target !== null && (
        <Stack spacing={3}>
          <Text fontSize="sm">
            {noShow.target.guest.fullName} · {noShow.target.code} ·{' '}
            {t('frontOffice.noShow.arrival', {
              date: formatCalendarDate(noShow.target.checkInDate),
            })}
          </Text>
          <Field
            label={t('frontOffice.noShow.reason')}
            helper={t('frontOffice.noShow.reasonHelper')}
          >
            <Textarea
              rows={3}
              value={noShow.reason}
              maxLength={500}
              onChange={(event) => noShow.setReason(event.target.value)}
            />
          </Field>
        </Stack>
      )}
    </ActionDialog>
  );
}
