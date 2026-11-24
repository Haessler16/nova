'use client';

import { Box, Stack, Text } from '@chakra-ui/react';
import { SectionCard } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { OperationalClose } from '@/lib/types';
import type { CashierAudit } from '../_hooks/use-cashier-audit';
import { CashierAuditForm } from './cashier-audit-form';
import { CashierLatestClose } from './cashier-latest-close';

export function CashierCloseDayCard({
  latestClose,
  audit,
  onReopen,
}: {
  latestClose: OperationalClose | null;
  audit: CashierAudit;
  onReopen: (target: OperationalClose) => void;
}) {
  const { t } = useI18n();

  return (
    <SectionCard>
      <Box mb={4}>
        <Text fontWeight="semibold">{t('cashier.daily.title')}</Text>

        <Text fontSize="xs" color="textSecondary">
          {t('cashier.daily.description')}
        </Text>
      </Box>

      {latestClose !== null && <CashierLatestClose close={latestClose} onReopen={onReopen} />}

      {audit.blockers.length > 0 && (
        <Box
          mb={4}
          p={3}
          borderWidth="1px"
          borderColor="warning.200"
          borderRadius="lg"
          bg="warning.50"
        >
          <Text fontSize="sm" fontWeight="semibold" color="warning.700" mb={2}>
            {t('cashier.daily.blockers')}
          </Text>
          <Stack spacing={1}>
            {audit.blockers.map((blocker) => (
              <Text key={blocker.code} fontSize="xs" color="warning.700">
                {t('cashier.daily.blockerLine', {
                  message: blocker.message,
                  count: blocker.count,
                })}
              </Text>
            ))}
          </Stack>
        </Box>
      )}

      <CashierAuditForm audit={audit} />
    </SectionCard>
  );
}
