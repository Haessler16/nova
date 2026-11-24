'use client';

import { Box, Button, Input, Stack } from '@chakra-ui/react';
import { DateField } from '@/components/date-field';
import { Field } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { CashierOpen } from '../_hooks/use-cashier-session';

export function CashierOpenForm({ open, cup }: { open: CashierOpen; cup: string }) {
  const { t } = useI18n();

  return (
    <Box as="form" onSubmit={(event) => void open.submit(event)}>
      <Stack spacing={3}>
        <Field label={t('cashier.open.name')} isRequired error={open.errors['open.name']}>
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
          label={t('cashier.open.operationalDate')}
          isRequired
          error={open.errors['open.operationalDate']}
          helper={t('cashier.open.operationalDateHelper')}
        >
          <DateField
            value={open.form.operationalDate}
            placeholder={t('dateField.placeholder')}
            ariaLabel={t('cashier.open.operationalDateAria')}
            onChange={(operationalDate) =>
              open.setForm((current) => ({ ...current, operationalDate }))
            }
          />
        </Field>
        <Field
          label={t('cashier.open.openingAmount', { currency: cup })}
          isRequired
          error={open.errors['open.openingAmount']}
          helper={t('cashier.open.amountHelper')}
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
        <Button type="submit" colorScheme="brand" alignSelf="flex-start" isLoading={open.saving}>
          {t('cashier.open.submit')}
        </Button>
      </Stack>
    </Box>
  );
}
