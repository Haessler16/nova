/**
 * Atomic permission keys. Keep authorization decisions in the backend; the web
 * app may hide controls for UX but never decides access.
 */
export const PERMISSIONS = {
  PROPERTY_READ: 'property.read',
  PROPERTY_MANAGE: 'property.manage',
  ORGANIZATION_PROPERTIES_MANAGE: 'organization.properties.manage',
  AUDIT_READ: 'audit.read',
  INVENTORY_READ: 'inventory.read',
  INVENTORY_MANAGE: 'inventory.manage',
  HOUSEKEEPING_MANAGE: 'housekeeping.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly PermissionKey[] = Object.values(PERMISSIONS);
