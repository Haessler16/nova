'use client';

import { Box, Button, Input, Select, Stack } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/ui';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { validationCopy } from '../../../reservations/_lib/reservation-labels';
import {
  buildErrors,
  hasErrors,
  moneyField,
  optionalText,
  type FieldErrors,
} from '@/lib/validation';
import type { FolioAction } from '../_lib/use-folio-action';

const PAYMENT_METHODS: ReadonlyArray<{ value: string; labelKey: TranslationKey }> = [
  { value: 'CASH', labelKey: 'paymentMethods.cash' },
  { value: 'CREDIT_CARD', labelKey: 'paymentMethods.creditCard' },
  { value: 'DEBIT_CARD', labelKey: 'paymentMethods.debitCard' },
  { value: 'BANK_TRANSFER', labelKey: 'paymentMethods.bankTransfer' },
  { value: 'OTHER', labelKey: 'paymentMethods.other' },
];

export function FolioPaymentForm({
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
  const [payment, setPayment] = useState({ amount: '', method: 'CASH', referenceId: '' });

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const copy = validationCopy(t);
    const nextErrors = buildErrors([
      [
        'payment.amount',
        moneyField(payment.amount, t('folioDetail.validation.amount'), { allowZero: false }, copy),
      ],
      [
        'payment.referenceId',
        optionalText(payment.referenceId, t('folioDetail.validation.reference'), { max: 64 }, copy),
      ],
    ]);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    await action.run(
      'payment',
      () =>
        api(`/api/v1/folios/${folioId}/payments`, {
          method: 'POST',
          tenant,
          body: {
            amount: payment.amount,
            method: payment.method,
            ...(payment.referenceId.trim() !== ''
              ? { referenceId: payment.referenceId.trim() }
              : {}),
            idempotencyKey: `payment-ui-${crypto.randomUUID()}`,
          },
        }),
      t('folioDetail.toast.payment'),
      () => setPayment({ amount: '', method: 'CASH', referenceId: '' }),
    );
  }

  return (
    <Box as="form" onSubmit={submit}>
      <Stack spacing={3}>
        <Field
          label={t('folioDetail.payments.amountLabel', { currency })}
          isRequired
          error={errors['payment.amount']}
          helper={t('folioDetail.payments.amountHelper')}
        >
          <Input
            size="sm"
            inputMode="decimal"
            value={payment.amount}
            onChange={(event) =>
              setPayment((current) => ({ ...current, amount: event.target.value }))
            }
            required
          />
        </Field>
        <Field label={t('folioDetail.payments.methodLabel')} isRequired>
          <Select
            size="sm"
            value={payment.method}
            onChange={(event) =>
              setPayment((current) => ({ ...current, method: event.target.value }))
            }
          >
            {PAYMENT_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {t(method.labelKey)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={t('folioDetail.payments.referenceLabel')}
          error={errors['payment.referenceId']}
          helper={t('folioDetail.payments.referenceHelper')}
        >
          <Input
            size="sm"
            value={payment.referenceId}
            maxLength={64}
            onChange={(event) =>
              setPayment((current) => ({ ...current, referenceId: event.target.value }))
            }
          />
        </Field>
        <Button type="submit" size="sm" colorScheme="brand" isLoading={action.busy === 'payment'}>
          {t('folioDetail.payments.submit')}
        </Button>
      </Stack>
    </Box>
  );
}
