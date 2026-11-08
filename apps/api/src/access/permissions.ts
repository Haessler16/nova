/**
 * Atomic permission keys. Keep authorization decisions in the backend; the web
 * app may hide controls for UX but never decides access.
 */
export const PERMISSIONS = {
  PROPERTY_READ: 'property.read',
  PROPERTY_MANAGE: 'property.manage',
  AUDIT_READ: 'audit.read',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly PermissionKey[] = Object.values(PERMISSIONS);
