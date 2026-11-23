'use client';

import { useMemo, useState } from 'react';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import type { Membership, Role, SecurityEvent } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';
import type { AdminTenant } from '../_lib/admin';

export function useAdminData() {
  const { tenant } = useSession();
  const adminTenant = useMemo<AdminTenant>(
    () => ({ organizationId: tenant.organizationId }),
    [tenant.organizationId],
  );

  const memberships = useAsyncData<{ items: Membership[] }>(
    () => api<{ items: Membership[] }>('/api/v1/admin/memberships', { tenant: adminTenant }),
    `admin:memberships:${tenant.organizationId}`,
  );
  const roles = useAsyncData<{ items: Role[] }>(
    () => api<{ items: Role[] }>('/api/v1/admin/roles', { tenant: adminTenant }),
    `admin:roles:${tenant.organizationId}:${memberships.data !== null}`,
  );
  const permissions = useAsyncData<{ items: string[] }>(
    () => api<{ items: string[] }>('/api/v1/admin/permissions', { tenant: adminTenant }),
    `admin:permissions:${tenant.organizationId}`,
  );

  const [severityFilter, setSeverityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const securityEvents = useAsyncData<{ items: SecurityEvent[]; nextCursor: string | null }>(() => {
    const params = new URLSearchParams({ limit: '100' });
    if (severityFilter !== '') params.set('severity', severityFilter);
    if (typeFilter.trim() !== '') params.set('type', typeFilter.trim());
    return api<{ items: SecurityEvent[]; nextCursor: string | null }>(
      `/api/v1/admin/security-events?${params.toString()}`,
      { tenant: adminTenant },
    );
  }, `admin:security:${tenant.organizationId}:${severityFilter}:${typeFilter}`);

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const permission of permissions.data?.items ?? []) {
      const [head] = permission.split('.');
      const key = head ?? permission;
      groups.set(key, [...(groups.get(key) ?? []), permission]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions.data]);

  return {
    adminTenant,
    memberships,
    roles,
    permissions,
    securityEvents,
    severityFilter,
    setSeverityFilter,
    typeFilter,
    setTypeFilter,
    permissionGroups,
  };
}

export type AdminData = ReturnType<typeof useAdminData>;
