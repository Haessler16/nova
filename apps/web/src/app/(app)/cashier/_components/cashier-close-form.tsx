'use client';

import { Box, Button, Input, Stack, Text, Textarea } from '@chakra-ui/react';
import { Field } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
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
  const { t } = useI18n();

  return (
    <Box as="form" onSubmit={() => void close.submit()}>
      <Stack spacing={3}>
        <Text fontWeight="semibold" fontSize="sm">
          {t('cashier.close.title')}
        </Text>
        <Field
          label={t('cashier.close.closingAmount', { currency: cup })}
          isRequired
          error={close.errors['close.closingAmount']}
          helper={t('cashier.close.expectedHint', {
            amount: formatMoney(session.expectedCashAmount, cup),
          })}
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
          label={t('cashier.close.varianceReason')}
          error={close.errors['close.varianceReason']}
          helper={t('cashier.close.varianceHelper')}
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
        <Field label={t('cashier.close.notes')}>
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
          {t('cashier.close.submit')}
        </Button>
      </Stack>
    </Box>
  );
}
