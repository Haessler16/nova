'use client';

import { Box, Button, Input, Select, Stack, Text } from '@chakra-ui/react';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/ui';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { validationCopy } from '../../../reservations/_lib/reservation-labels';
import type { FolioProduct } from '@/lib/types';
import { buildErrors, hasErrors, moneyField, type FieldErrors } from '@/lib/validation';
import type { FolioAction } from '../_lib/use-folio-action';

export function FolioConsumptionForm({
  folioId,
  catalog,
  action,
}: {
  folioId: string;
  catalog: FolioProduct[];
  action: FolioAction;
}) {
  const { t } = useI18n();
  const { tenant } = useSession();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [consumption, setConsumption] = useState({ productId: '', quantity: '1' });

  const selectedProduct = catalog.find((item) => item.id === consumption.productId) ?? null;

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const copy = validationCopy(t);
    const nextErrors = buildErrors([
      [
        'consumption.productId',
        consumption.productId === '' ? t('folioDetail.consumption.productRequired') : null,
      ],
      [
        'consumption.quantity',
        moneyField(
          consumption.quantity,
          t('folioDetail.validation.quantity'),
          { allowZero: false },
          copy,
        ),
      ],
    ]);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      return;
    }
    await action.run(
      'consumption',
      () =>
        api(`/api/v1/folios/${folioId}/charges`, {
          method: 'POST',
          tenant,
          body: {
            productId: consumption.productId,
            quantity: consumption.quantity,
            idempotencyKey: `consume-ui-${crypto.randomUUID()}`,
          },
        }),
      t('folioDetail.toast.consumption'),
      () => setConsumption({ productId: '', quantity: '1' }),
    );
  }

  return (
    <Box as="form" onSubmit={submit}>
      <Stack spacing={3}>
        <Text fontWeight="semibold" fontSize="sm">
          {t('folioDetail.consumption.title')}
        </Text>
        <Field
          label={t('folioDetail.consumption.product')}
          isRequired
          error={errors['consumption.productId']}
          helper={catalog.length === 0 ? t('folioDetail.consumption.noProducts') : undefined}
        >
          <Select
            size="sm"
            value={consumption.productId}
            onChange={(event) =>
              setConsumption((current) => ({ ...current, productId: event.target.value }))
            }
            required
          >
            <option value="">{t('folioDetail.consumption.select')}</option>
            {catalog.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {formatMoney(item.unitAmount, item.currencyCode)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={t('folioDetail.consumption.quantity')}
          isRequired
          error={errors['consumption.quantity']}
          helper={
            selectedProduct === null
              ? t('folioDetail.consumption.priceHint')
              : t('folioDetail.consumption.priceCurrent', {
                  price: formatMoney(selectedProduct.unitAmount, selectedProduct.currencyCode),
                  unit: selectedProduct.unit,
                })
          }
        >
          <Input
            size="sm"
            inputMode="decimal"
            value={consumption.quantity}
            onChange={(event) =>
              setConsumption((current) => ({ ...current, quantity: event.target.value }))
            }
            required
          />
        </Field>
        <Button
          type="submit"
          size="sm"
          colorScheme="brand"
          alignSelf="flex-start"
          isLoading={action.busy === 'consumption'}
        >
          {t('folioDetail.consumption.submit')}
        </Button>
      </Stack>
    </Box>
  );
}
