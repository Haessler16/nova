'use client';

import { Box, Button, Input, Stack, Text } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/ui';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { validationCopy } from '../../../reservations/_lib/reservation-labels';
import {
  buildErrors,
  hasErrors,
  moneyField,
  requiredText,
  type FieldErrors,
} from '@/lib/validation';
import type { FolioAction } from '../_lib/use-folio-action';

export function FolioChargeForm({
  folioId,
  currency,
  action,
}: {
  folioId: string;
  currency: string;
  action: FolioAction;
}) {
  const { t } = useI18n();
  const { tenant } = useSession();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [charge, setCharge] = useState({ description: '', amount: '' });

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const copy = validationCopy(t);
    const nextErrors = buildErrors([
      [
        'charge.description',
        requiredText(charge.description, t('folioDetail.validation.concept'), { max: 120 }, copy),
      ],
      [
        'charge.amount',
        moneyField(charge.amount, t('folioDetail.validation.amount'), { allowZero: false }, copy),
      ],
    ]);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    await action.run(
      'charge',
      () =>
        api(`/api/v1/folios/${folioId}/charges`, {
          method: 'POST',
          tenant,
          body: {
            description: charge.description,
            amount: charge.amount,
            idempotencyKey: `charge-ui-${crypto.randomUUID()}`,
          },
        }),
      t('folioDetail.toast.charge'),
      () => setCharge({ description: '', amount: '' }),
    );
  }

  return (
    <Box as="form" onSubmit={submit}>
      <Stack spacing={3}>
        <Text fontWeight="semibold" fontSize="sm">
          {t('folioDetail.charge.title')}
        </Text>
        <Field
          label={t('folioDetail.charge.concept')}
          isRequired
          error={errors['charge.description']}
        >
          <Input
            size="sm"
            value={charge.description}
            maxLength={120}
            onChange={(event) =>
              setCharge((current) => ({ ...current, description: event.target.value }))
            }
            required
          />
        </Field>
        <Field
          label={t('folioDetail.charge.amount', { currency })}
          isRequired
          error={errors['charge.amount']}
          helper={t('folioDetail.charge.helper')}
        >
          <Input
            size="sm"
            inputMode="decimal"
            value={charge.amount}
            onChange={(event) =>
              setCharge((current) => ({ ...current, amount: event.target.value }))
            }
            required
          />
        </Field>
        <Button type="submit" size="sm" colorScheme="brand" isLoading={action.busy === 'charge'}>
          {t('folioDetail.charge.submit')}
        </Button>
      </Stack>
    </Box>
  );
}
