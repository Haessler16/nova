'use client';

import { Stack, Text, Textarea } from '@chakra-ui/react';
import { ActionDialog } from '@/components/action-dialog';
import { Field } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { IncidentResolveController } from '../_hooks/use-incidents';

export function ResolveDialog({
  resolve,
  busy,
}: {
  resolve: IncidentResolveController;
  busy: string | null;
}) {
  const { t } = useI18n();

  return (
    <ActionDialog
      isOpen={resolve.modal.isOpen}
      onClose={resolve.modal.onClose}
      tone="info"
      title={t('frontOffice.resolve.title')}
      summary={t('frontOffice.resolve.summary')}
      confirmLabel={t('frontOffice.incidents.resolve')}
      onConfirm={() => void resolve.confirm()}
      isLoading={busy?.startsWith('incident:resolve') === true}
      confirmDisabled={resolve.resolution.trim().length < 3}
      hasUnsavedChanges={resolve.resolution.trim() !== ''}
      error={resolve.error === null ? undefined : errorMessage(resolve.error)}
    >
      {resolve.target !== null && (
        <Stack spacing={3}>
          <Text fontSize="sm" fontWeight="medium">
            {resolve.target.title}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {resolve.target.description}
          </Text>
          <Field
            label={t('frontOffice.resolve.label')}
            isRequired
            helper={t('frontOffice.resolve.helper')}
          >
            <Textarea
              rows={4}
              value={resolve.resolution}
              maxLength={4000}
              onChange={(event) => resolve.setResolution(event.target.value)}
              required
            />
          </Field>
        </Stack>
      )}
    </ActionDialog>
  );
}
