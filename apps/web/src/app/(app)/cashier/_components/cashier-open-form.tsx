'use client';

import { Box, Button, Input, Stack } from '@chakra-ui/react';
import { DateField } from '@/components/date-field';
import { Field } from '@/components/ui';
import type { CashierOpen } from '../_hooks/use-cashier-session';

export function CashierOpenForm({ open, cup }: { open: CashierOpen; cup: string }) {
  return (
    <Box as="form" onSubmit={(event) => void open.submit(event)}>
      <Stack spacing={3}>
        <Field label="Nombre de la sesión" isRequired error={open.errors['open.name']}>
          <Input
            size="sm"
            value={open.form.name}
            maxLength={120}
            onChange={(event) =>
              open.setForm((current) => ({ ...current, name: event.target.value }))
            }
            required
          />
        </Field>
        <Field
          label="Día operativo"
          isRequired
          error={open.errors['open.operationalDate']}
          helper="No puede ser posterior al día operativo actual."
        >
          <DateField
            value={open.form.operationalDate}
            placeholder="dd/mm/aaaa"
            ariaLabel="Día operativo de la sesión"
            onChange={(operationalDate) =>
              open.setForm((current) => ({ ...current, operationalDate }))
            }
          />
        </Field>
        <Field
          label={`Fondo inicial (${cup})`}
          isRequired
          error={open.errors['open.openingAmount']}
          helper="Hasta dos decimales."
        >
          <Input
            size="sm"
            inputMode="decimal"
            value={open.form.openingAmount}
            onChange={(event) =>
              open.setForm((current) => ({
                ...current,
                openingAmount: event.target.value,
              }))
            }
            required
          />
        </Field>
        <Button
          type="submit"
          colorScheme="brand"
          alignSelf="flex-start"
          isLoading={open.saving}
        >
          Abrir caja
        </Button>
      </Stack>
    </Box>
  );
}
