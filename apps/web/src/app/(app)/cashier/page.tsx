'use client';

import { SimpleGrid } from '@chakra-ui/react';
import { PropertyGate } from '@/components/app-shell';
import { PageHeader } from '@/components/ui';
import { CashierCloseDayCard } from './_components/cashier-close-day-card';
import { CashierClosesTable } from './_components/cashier-closes-table';
import { CashierMetrics } from './_components/cashier-metrics';
import { CashierReopenDialog } from './_components/cashier-reopen-dialog';
import { CashierSessionCard } from './_components/cashier-session-card';
import { CashierSessionsTable } from './_components/cashier-sessions-table';
import { useCashierAudit } from './_hooks/use-cashier-audit';
import { useCashierClose } from './_hooks/use-cashier-close';
import { useCashierData } from './_hooks/use-cashier-data';
import { useCashierMovement } from './_hooks/use-cashier-movement';
import { useCashierReopen } from './_hooks/use-cashier-reopen';
import { useCashierOpen } from './_hooks/use-cashier-session';

function CashierContent() {
  const data = useCashierData();
  const open = useCashierOpen(data.operationalDate, () => data.sessions.reload());
  const movement = useCashierMovement(data.openSession, () => data.sessions.reload());
  const close = useCashierClose(data.openSession, () => data.sessions.reload());
  const audit = useCashierAudit(data.operationalDate, () => {
    data.closes.reload();
    data.sessions.reload();
  });
  const reopen = useCashierReopen(() => data.closes.reload());

  return (
    <>
      <PageHeader
        eyebrow="Caja y cierre"
        title="Caja y día operativo"
        description="Apertura, movimientos y arqueo de caja, más el cierre del día operativo. El backend valida arqueo, bloqueos y permisos; forzar un cierre requiere un motivo auditado."
      />

      <CashierMetrics data={data} />

      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={5} alignItems="start" mb={5}>
        <CashierSessionCard data={data} open={open} movement={movement} close={close} />
        <CashierCloseDayCard
          latestClose={data.latestClose}
          audit={audit}
          onReopen={reopen.open}
        />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={5} alignItems="start">
        <CashierSessionsTable data={data} />
        <CashierClosesTable data={data} onReopen={reopen.open} />
      </SimpleGrid>

      <CashierReopenDialog reopen={reopen} />
    </>
  );
}

export default function CashierPage() {
  return (
    <PropertyGate>
      <CashierContent />
    </PropertyGate>
  );
}
