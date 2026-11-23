'use client';

import { Box, Button, Input, Select, Stack, Text } from '@chakra-ui/react';
import { Field } from '@/components/ui';
import { CASH_MOVEMENT_LABELS } from '@/lib/format';
import type { CashMovementType } from '@/lib/types';
import { MOVEMENT_TYPES } from '../_lib/cashier-forms';
import type { CashierMovement } from '../_hooks/use-cashier-movement';

export function CashierMovementForm({
  movement,
  cup,
}: {
  movement: CashierMovement;
  cup: string;
}) {
  return (
    <Box as="form" onSubmit={(event) => void movement.submit(event)}>
      <Stack spacing={3}>
        <Text fontWeight="semibold" fontSize="sm">
          Registrar movimiento
        </Text>
        <Field label="Tipo" isRequired>
          <Select
            size="sm"
            value={movement.form.type}
            onChange={(event) =>
              movement.setForm((current) => ({
                ...current,
                type: event.target.value as CashMovementType,
              }))
            }
          >
            {MOVEMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {CASH_MOVEMENT_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={`Importe (${cup})`}
          isRequired
          error={movement.errors['movement.amount']}
          helper="Hasta dos decimales."
        >
          <Input
            size="sm"
            inputMode="decimal"
            value={movement.form.amount}
            onChange={(event) =>
              movement.setForm((current) => ({
                ...current,
                amount: event.target.value,
              }))
            }
            required
          />
        </Field>
        <Field label="Detalle" error={movement.errors['movement.description']}>
          <Input
            size="sm"
            value={movement.form.description}
            maxLength={4000}
            onChange={(event) =>
              movement.setForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
        </Field>
        <Button
          type="submit"
          size="sm"
          colorScheme="brand"
          alignSelf="flex-start"
          isLoading={movement.saving}
        >
          Registrar
        </Button>
      </Stack>
    </Box>
  );
}
