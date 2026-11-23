'use client';

import { Box, Stack, Text } from '@chakra-ui/react';
import { SectionCard } from '@/components/ui';
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
  return (
    <SectionCard>
      <Box mb={4}>
        <Text fontWeight="semibold">Cierre del día operativo</Text>

        <Text fontSize="xs" color="textSecondary">
          Night audit: exige caja cerrada, folios resueltos y llegadas o estancias pendientes
          resueltas. Podés forzar el cierre con un motivo auditado.
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
            Bloqueos detectados
          </Text>
          <Stack spacing={1}>
            {audit.blockers.map((blocker) => (
              <Text key={blocker.code} fontSize="xs" color="warning.700">
                {blocker.message} ({blocker.count})
              </Text>
            ))}
          </Stack>
        </Box>
      )}

      <CashierAuditForm audit={audit} />
    </SectionCard>
  );
}
