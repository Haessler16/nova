'use client';

import { Box, Button, Input, Stack, Text, Textarea } from '@chakra-ui/react';
import { Field } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import type { CashSession } from '@/lib/types';
import type { CashierClose } from '../_hooks/use-cashier-close';

export function CashierCloseForm({
  close,
  session,
  cup,
}: {
  close: CashierClose;
  session: CashSession;
  cup: string;
}) {
  return (
    <Box as="form" onSubmit={() => void close.submit()}>
      <Stack spacing={3}>
        <Text fontWeight="semibold" fontSize="sm">
          Cerrar y arquear
        </Text>
        <Field
          label={`Efectivo contado (${cup})`}
          isRequired
          error={close.errors['close.closingAmount']}
          helper={`Esperado: ${formatMoney(session.expectedCashAmount, cup)}`}
        >
          <Input
            size="sm"
            inputMode="decimal"
            value={close.form.closingAmount}
            onChange={(event) =>
              close.setForm((current) => ({
                ...current,
                closingAmount: event.target.value,
              }))
            }
            required
          />
        </Field>
        <Field
          label="Motivo de diferencia"
          error={close.errors['close.varianceReason']}
          helper="Obligatorio si el contado difiere del esperado."
        >
          <Input
            size="sm"
            value={close.form.varianceReason}
            maxLength={500}
            onChange={(event) =>
              close.setForm((current) => ({
                ...current,
                varianceReason: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Notas">
          <Textarea
            size="sm"
            rows={2}
            maxLength={4000}
            value={close.form.notes}
            onChange={(event) =>
              close.setForm((current) => ({
                ...current,
                notes: event.target.value,
              }))
            }
          />
        </Field>
        <Button
          type="submit"
          size="sm"
          colorScheme="mint"
          alignSelf="flex-start"
          isLoading={close.saving}
        >
          Cerrar caja
        </Button>
      </Stack>
    </Box>
  );
}
