'use client';

import { useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

/**
 * Runs one folio mutation: toggles the busy key, toasts the localized error and
 * reloads the folio on success.
 */
export function useFolioAction(onChanged: () => void) {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(
    key: string,
    action: () => Promise<unknown>,
    successMessage: string,
    after?: () => void,
  ): Promise<void> {
    setBusy(key);
    try {
      await action();
      toast({ title: successMessage, status: 'success' });
      after?.();
      onChanged();
    } catch (cause) {
      toast({
        title: t('folioDetail.toast.failed'),
        description: errorMessage(cause),
        status: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  return { busy, run };
}

export type FolioAction = ReturnType<typeof useFolioAction>;
