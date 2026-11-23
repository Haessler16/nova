'use client';

import { Stack, Text, Textarea } from '@chakra-ui/react';
import { ActionDialog } from '@/components/action-dialog';
import { Field } from '@/components/ui';
import { formatCalendarDate } from '@/lib/format';
import type { CashierReopen } from '../_hooks/use-cashier-reopen';

export function CashierReopenDialog({ reopen }: { reopen: CashierReopen }) {
  return (
    <ActionDialog
      isOpen={reopen.modal.isOpen}
      onClose={reopen.close}
      tone="critical"
      title="Reabrir día operativo"
      summary={
        reopen.target === null
          ? 'Seleccioná un cierre para ver el resumen aquí.'
          : `Reabrir el cierre de ${formatCalendarDate(reopen.target.operationalDate)} vuelve a dejar el día
            operativo pendiente de noche. La acción queda auditada con el motivo y no borra el
            registro anterior.`
      }
      confirmLabel="Reabrir día"
      hasUnsavedChanges={reopen.reason.trim().length > 0}
      isLoading={reopen.saving}
      error={reopen.apiError ?? undefined}
      onConfirm={() => void reopen.submit()}
    >
      <Stack spacing={3}>
        <Field label="Motivo" isRequired error={reopen.errors['reopen.reason']}>
          <Textarea
            value={reopen.reason}
            onChange={(event) => reopen.setReason(event.target.value)}
            maxLength={500}
            rows={3}
            required
          />
        </Field>
        <Text fontSize="xs" color="textSecondary">
          Reabrir un día ya cerrado solo debe usarse para corregir errores de cierre; el motivo
          queda registrado en la auditoría.
        </Text>
      </Stack>
    </ActionDialog>
  );
}
