'use client';

import { Badge, Box, Divider, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { QueryFeedback, SectionCard } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { CashierData } from '../_hooks/use-cashier-data';
import type { CashierClose } from '../_hooks/use-cashier-close';
import type { CashierMovement } from '../_hooks/use-cashier-movement';
import type { CashierOpen } from '../_hooks/use-cashier-session';
import { CashierCloseForm } from './cashier-close-form';
import { CashierMovementForm } from './cashier-movement-form';
import { CashierMovementsTable } from './cashier-movements-table';
import { CashierOpenForm } from './cashier-open-form';
import { CashierSessionSummary } from './cashier-session-summary';

export function CashierSessionCard({
  data,
  open,
  movement,
  close,
}: {
  data: CashierData;
  open: CashierOpen;
  movement: CashierMovement;
  close: CashierClose;
}) {
  const { t } = useI18n();
  const { sessions, openSession, cup } = data;

  return (
    <SectionCard>
      <HStack justify="space-between" mb={4}>
        <Box>
          <Text fontWeight="semibold">{t('cashier.session.title')}</Text>
          <Text fontSize="xs" color="textSecondary">
            {t('cashier.session.subtitle')}
          </Text>
        </Box>
        {openSession !== null && (
          <Badge colorScheme="mint">{formatMoney(openSession.expectedCashAmount, cup)}</Badge>
        )}
      </HStack>

      <QueryFeedback loading={sessions.loading} error={sessions.error} onRetry={sessions.reload}>
        {openSession === null ? (
          <CashierOpenForm open={open} cup={cup} />
        ) : (
          <Stack spacing={4}>
            <CashierSessionSummary session={openSession} cup={cup} />

            <Divider />

            <CashierMovementsTable session={openSession} />

            <Divider />

            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4} alignItems="start">
              <CashierMovementForm movement={movement} cup={cup} />
              <CashierCloseForm close={close} session={openSession} cup={cup} />
            </SimpleGrid>
          </Stack>
        )}
        {close.apiError !== null && (
          <Text fontSize="xs" color="danger.500" mt={1}>
            {close.apiError}
          </Text>
        )}
      </QueryFeedback>
    </SectionCard>
  );
}
