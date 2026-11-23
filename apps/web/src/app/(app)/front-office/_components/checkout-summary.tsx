'use client';

import { Box, Checkbox, HStack, Stack, Text, Textarea } from '@chakra-ui/react';
import { Field } from '@/components/ui';
import { formatMoney, housekeepingLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { CheckoutReadiness } from '@/lib/types';

export function CheckoutSummary({
  readiness,
  fallbackCurrency,
  allowBalance,
  onAllowBalanceChange,
  balanceReason,
  onBalanceReasonChange,
}: {
  readiness: CheckoutReadiness;
  fallbackCurrency: string;
  allowBalance: boolean;
  onAllowBalanceChange: (value: boolean) => void;
  balanceReason: string;
  onBalanceReasonChange: (value: string) => void;
}) {
  const { t, locale } = useI18n();
  const currency = readiness.folios[0]?.currencyCode ?? fallbackCurrency;
  const hasBalance = readiness.totals.balance !== '0.00';

  return (
    <Box borderWidth="1px" borderColor="line" borderRadius="md" p={3}>
      <Stack spacing={1}>
        <HStack justify="space-between">
          <Text fontSize="xs" color="gray.500">
            {t('frontOffice.checkout.charges')}
          </Text>
          <Text fontSize="sm">{formatMoney(readiness.totals.charges, currency)}</Text>
        </HStack>
        <HStack justify="space-between">
          <Text fontSize="xs" color="gray.500">
            {t('frontOffice.checkout.payments')}
          </Text>
          <Text fontSize="sm">{formatMoney(readiness.totals.payments, currency)}</Text>
        </HStack>
        <HStack justify="space-between">
          <Text fontSize="xs" color="gray.500">
            {t('frontOffice.checkout.balance')}
          </Text>
          <Text fontSize="sm" fontWeight="semibold">
            {formatMoney(readiness.totals.balance, currency)}
          </Text>
        </HStack>
        <HStack justify="space-between">
          <Text fontSize="xs" color="gray.500">
            {t('frontOffice.checkout.housekeeping')}
          </Text>
          <Text fontSize="sm">
            {housekeepingLabel(locale, readiness.housekeeping.current)} →{' '}
            {housekeepingLabel(locale, readiness.housekeeping.target)}
          </Text>
        </HStack>
      </Stack>

      {readiness.warnings.length > 0 && (
        <Stack spacing={1} mt={3}>
          {readiness.warnings.map((warning) => (
            <Text key={warning.code} fontSize="xs" color="warning.700">
              {warning.message}
            </Text>
          ))}
        </Stack>
      )}
      {readiness.blockedReasons.length > 0 && (
        <Stack spacing={1} mt={3}>
          {readiness.blockedReasons.map((reason) => (
            <Text key={reason.code} fontSize="xs" color="danger.600">
              {reason.message}
            </Text>
          ))}
        </Stack>
      )}

      {hasBalance && (
        <Stack spacing={2} mt={3}>
          <Checkbox
            size="sm"
            isChecked={allowBalance}
            onChange={(event) => onAllowBalanceChange(event.target.checked)}
          >
            {t('frontOffice.checkout.allowBalance')}
          </Checkbox>
          {allowBalance && (
            <Field
              label={t('frontOffice.checkout.reason')}
              isRequired
              helper={t('frontOffice.checkout.reasonHelper')}
            >
              <Textarea
                size="sm"
                rows={2}
                maxLength={500}
                value={balanceReason}
                onChange={(event) => onBalanceReasonChange(event.target.value)}
                required
              />
            </Field>
          )}
        </Stack>
      )}
    </Box>
  );
}
