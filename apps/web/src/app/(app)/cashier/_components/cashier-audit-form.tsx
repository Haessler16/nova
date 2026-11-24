'use client';

import { Box, Button, Checkbox, Stack, Textarea } from '@chakra-ui/react';
import { DateField } from '@/components/date-field';
import { Field } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { CashierAudit } from '../_hooks/use-cashier-audit';

export function CashierAuditForm({ audit }: { audit: CashierAudit }) {
  const { t } = useI18n();

  return (
    <Box as="form" onSubmit={(event) => void audit.submit(event)}>
      <Stack spacing={3}>
        <Field
          label={t('cashier.audit.operationalDate')}
          isRequired
          error={audit.errors['audit.operationalDate']}
        >
          <DateField
            value={audit.form.operationalDate}
            placeholder={t('dateField.placeholder')}
            ariaLabel={t('cashier.audit.operationalDateAria')}
            onChange={(operationalDate) =>
              audit.setForm((current) => ({ ...current, operationalDate }))
            }
          />
        </Field>
        <Checkbox
          size="sm"
          isChecked={audit.form.force}
          onChange={(event) =>
            audit.setForm((current) => ({ ...current, force: event.target.checked }))
          }
        >
          {t('cashier.audit.force')}
        </Checkbox>
        {audit.form.force && (
          <Field
            label={t('cashier.audit.forceReason')}
            isRequired
            error={audit.errors['audit.forceReason']}
          >
            <Textarea
              size="sm"
              rows={2}
              maxLength={500}
              value={audit.form.forceReason}
              onChange={(event) =>
                audit.setForm((current) => ({
                  ...current,
                  forceReason: event.target.value,
                }))
              }
              required
            />
          </Field>
        )}
        <Field label={t('cashier.audit.notes')}>
          <Textarea
            size="sm"
            rows={2}
            maxLength={4000}
            value={audit.form.notes}
            onChange={(event) =>
              audit.setForm((current) => ({ ...current, notes: event.target.value }))
            }
          />
        </Field>
        <Button type="submit" colorScheme="brand" alignSelf="flex-start" isLoading={audit.saving}>
          {t('cashier.audit.submit')}
        </Button>
      </Stack>
    </Box>
  );
}
