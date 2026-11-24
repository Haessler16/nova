'use client';

import {
  Badge,
  HStack,
  Input,
  Select,
  Stack,
  Textarea,
} from '@chakra-ui/react';
import { Field } from '@/components/ui';
import { productCategoryLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { FolioProduct, FolioProductCategory } from '@/lib/types';
import type { FieldErrors } from '@/lib/validation';
import { CATEGORIES, type ProductForm } from '../_lib/product-form';

export function ProductFormFields({
  form,
  onChange,
  errors,
  editing,
  currency,
}: {
  form: ProductForm;
  onChange: (updater: (current: ProductForm) => ProductForm) => void;
  errors: FieldErrors;
  editing: FolioProduct | null;
  currency: string;
}) {
  const { t, locale } = useI18n();

  return (
    <Stack spacing={4}>
      <Field
        label="SKU"
        isRequired
        error={errors.sku}
        helper={
          editing === null
            ? t('catalog.field.skuHelperCreate')
            : t('catalog.field.skuHelperEdit')
        }
      >
        <Input
          size="sm"
          value={form.sku}
          maxLength={32}
          isDisabled={editing !== null}
          onChange={(event) => onChange((current) => ({ ...current, sku: event.target.value }))}
          required
        />
      </Field>
      <Field label={t('catalog.field.name')} isRequired error={errors.name}>
        <Input
          size="sm"
          value={form.name}
          maxLength={120}
          onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))}
          required
        />
      </Field>
      <Field label={t('catalog.field.description')} error={errors.description}>
        <Textarea
          size="sm"
          rows={2}
          maxLength={400}
          value={form.description}
          onChange={(event) =>
            onChange((current) => ({ ...current, description: event.target.value }))
          }
        />
      </Field>
      <HStack spacing={3} align="flex-start">
        <Field label={t('catalog.field.category')} isRequired>
          <Select
            size="sm"
            value={form.category}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                category: event.target.value as FolioProductCategory,
              }))
            }
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {productCategoryLabel(locale, category)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('catalog.field.unit')} isRequired error={errors.unit}>
          <Input
            size="sm"
            value={form.unit}
            maxLength={8}
            onChange={(event) => onChange((current) => ({ ...current, unit: event.target.value }))}
            required
          />
        </Field>
      </HStack>
      <Field
        label={t('catalog.field.price', { currency })}
        isRequired
        error={errors.unitAmount}
        helper={t('catalog.field.priceHelper')}
      >
        <Input
          size="sm"
          inputMode="decimal"
          value={form.unitAmount}
          onChange={(event) =>
            onChange((current) => ({ ...current, unitAmount: event.target.value }))
          }
          required
        />
      </Field>
      <Badge colorScheme="sky" alignSelf="flex-start">
        {t('catalog.priceNotice')}
      </Badge>
    </Stack>
  );
}
