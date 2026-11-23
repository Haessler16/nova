'use client';

import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import type { OperationalDay } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import type { CashSessionList, OperationalCloseList } from '../_lib/cashier-forms';

export function useCashierData() {
  const { tenant } = useSession();

  const operationalDay = useAsyncData<OperationalDay>(
    () => api<OperationalDay>('/api/v1/properties/current/operational-day', { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:cashier:operational-day`,
  );

  const sessions = useAsyncData<CashSessionList>(
    () => api<CashSessionList>('/api/v1/cash-sessions', { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:cashier:sessions`,
  );

  const closes = useAsyncData<OperationalCloseList>(
    () => api<OperationalCloseList>('/api/v1/operational-days', { tenant }),
    `${tenant.organizationId}:${tenant.propertyId}:cashier:closes`,
  );

  const openSession = sessions.data?.items.find((item) => item.status === 'OPEN') ?? null;
  const latestClose = closes.data?.items[0] ?? null;
  const cup = openSession?.currencyCode ?? 'BRL';

  return {
    operationalDay,
    sessions,
    closes,
    openSession,
    latestClose,
    cup,
    operationalDate: operationalDay.data?.operationalDate,
  };
}

export type CashierData = ReturnType<typeof useCashierData>;
