export interface AdminTenant {
  organizationId: string | null;
}

export function permissionLabel(permission: string): string {
  return permission.split('.').join(' · ');
}
