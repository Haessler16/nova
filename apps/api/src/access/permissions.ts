/**
 * Atomic permission keys. Keep authorization decisions in the backend; the web
 * app may hide controls for UX but never decides access.
 */
export const PERMISSIONS = {
  PROPERTY_READ: 'property.read',
  PROPERTY_MANAGE: 'property.manage',
  ORGANIZATION_PROPERTIES_MANAGE: 'organization.properties.manage',
  ORGANIZATION_MEMBERS_READ: 'organization.members.read',
  ORGANIZATION_MEMBERS_MANAGE: 'organization.members.manage',
  ORGANIZATION_ROLES_READ: 'organization.roles.read',
  ORGANIZATION_ROLES_MANAGE: 'organization.roles.manage',
  AUDIT_READ: 'audit.read',
  SECURITY_EVENTS_READ: 'security.events.read',
  INVENTORY_READ: 'inventory.read',
  INVENTORY_MANAGE: 'inventory.manage',
  HOUSEKEEPING_MANAGE: 'housekeeping.manage',
  GUESTS_READ: 'guests.read',
  GUESTS_MANAGE: 'guests.manage',
  RESERVATIONS_READ: 'reservations.read',
  RESERVATIONS_MANAGE: 'reservations.manage',
  FRONT_OFFICE_READ: 'front_office.read',
  FRONT_OFFICE_MANAGE: 'front_office.manage',
  INCIDENTS_READ: 'incidents.read',
  INCIDENTS_MANAGE: 'incidents.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly PermissionKey[] = Object.values(PERMISSIONS);
