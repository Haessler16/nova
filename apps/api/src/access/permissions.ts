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
  FOLIO_READ: 'folio.read',
  FOLIO_MANAGE: 'folio.manage',
  PAYMENT_READ: 'payment.read',
  PAYMENT_MANAGE: 'payment.manage',
  CASH_READ: 'cash.read',
  CASH_MANAGE: 'cash.manage',
  NIGHT_AUDIT_READ: 'night_audit.read',
  NIGHT_AUDIT_MANAGE: 'night_audit.manage',
  PILOT_FEEDBACK_SUBMIT: 'pilot.feedback.submit',
  PILOT_FEEDBACK_READ: 'pilot.feedback.read',
  PILOT_FEEDBACK_MANAGE: 'pilot.feedback.manage',
  DOCUMENTS_READ: 'documents.read',
  DOCUMENTS_GENERATE: 'documents.generate',
  DOCUMENTS_MANAGE: 'documents.manage',
  REPORTS_READ: 'reports.read',
  REPORTS_FINANCIAL: 'reports.financial',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly PermissionKey[] = Object.values(PERMISSIONS);
