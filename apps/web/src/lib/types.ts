/** Shared response contracts mirrored from the NestJS API. */

export type AuthMode = 'local-session' | 'dev-header' | 'disabled';
export type RecordStatus = 'ACTIVE' | 'SUSPENDED' | 'INVITED' | 'DISABLED';
export type HousekeepingState = 'DIRTY' | 'CLEANING' | 'CLEAN' | 'INSPECTED';
export type RoomOperationalState = 'AVAILABLE' | 'OUT_OF_ORDER' | 'OUT_OF_SERVICE';
export type RoomBlockType = 'OUT_OF_ORDER' | 'OUT_OF_SERVICE';
export type RoomBlockStatus = 'ACTIVE' | 'RELEASED' | 'EXPIRED';
export type ReservationStatus =
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'NO_SHOW';
export type GuestDocumentType = 'PASSPORT' | 'NATIONAL_ID' | 'DRIVER_LICENSE' | 'OTHER';
export type SecuritySeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type StayStatus = 'IN_HOUSE' | 'CHECKED_OUT';
export type IncidentType = 'NOTE' | 'MAINTENANCE' | 'COMPLAINT' | 'SAFETY' | 'OTHER';
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type IncidentStatus = 'OPEN' | 'RESOLVED';

export interface Actor {
  id: string;
  email: string;
  name: string;
}

export interface RoleSummary {
  key: string;
  name: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  status: RecordStatus;
  membershipId: string;
  role: RoleSummary | null;
}

export interface PropertyAccessSummary {
  id: string;
  name: string;
  code: string;
  role: RoleSummary | null;
}

export interface MeResponse {
  id: string;
  email: string;
  name: string;
  memberships: Array<{
    organization: Omit<OrganizationSummary, 'membershipId' | 'role'>;
    role: RoleSummary | null;
    properties: PropertyAccessSummary[];
  }>;
}

export interface PropertySummary {
  id: string;
  name: string;
  code: string;
  timezone: string;
  currencyCode: string;
  operationalDayStart: string;
  status: RecordStatus;
}

export interface PropertyDetail extends PropertySummary {
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalDay {
  operationalDate: string;
  localDate: string;
  localTime: string;
  timezone: string;
  operationalDayStart: string;
}

export interface RoomType {
  id: string;
  organizationId: string;
  propertyId: string;
  name: string;
  code: string;
  description: string | null;
  capacityAdults: number;
  capacityChildren: number;
  bedType: string | null;
  status: RecordStatus;
  roomCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  organizationId: string;
  propertyId: string;
  roomTypeId: string;
  number: string;
  floor: string | null;
  building: string | null;
  attributes: string[];
  housekeepingState: HousekeepingState;
  operationalState: RoomOperationalState;
  status: RecordStatus;
  roomType: { id: string; name: string; code: string };
  createdAt: string;
  updatedAt: string;
}

export interface RoomBlock {
  id: string;
  roomId: string;
  type: RoomBlockType;
  status: RoomBlockStatus;
  reason: string;
  startsAt: string;
  endsAt: string;
  createdByUserId: string | null;
  releasedAt: string | null;
  releaseReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoomHistoryEntry {
  id: string;
  category: 'OPERATIONAL' | 'HOUSEKEEPING';
  fromState: string | null;
  toState: string;
  reason: string | null;
  actorUserId: string | null;
  roomBlockId: string | null;
  correlationId: string | null;
  occurredAt: string;
}

export interface Guest {
  id: string;
  organizationId: string;
  propertyId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  documentType: GuestDocumentType | null;
  documentNumber: string | null;
  notes: string | null;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Reservation {
  id: string;
  organizationId: string;
  propertyId: string;
  code: string;
  status: ReservationStatus;
  source: string | null;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  adults: number;
  children: number;
  guestId: string;
  roomTypeId: string;
  roomId: string | null;
  notes: string | null;
  idempotencyKey: string | null;
  createdByUserId: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  guest: { id: string; fullName: string; email: string | null; phone: string | null };
  roomType: { id: string; name: string; code: string };
  room: { id: string; number: string; floor: string | null; building: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityItem {
  roomId: string;
  number: string;
  floor: string | null;
  building: string | null;
  roomTypeId: string;
  roomType: { name: string; code: string };
}

export interface Availability {
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  items: AvailabilityItem[];
}

export interface ReservationHistoryEntry {
  id: string;
  action: string;
  fromStatus: ReservationStatus | null;
  toStatus: ReservationStatus | null;
  fromRoomId: string | null;
  toRoomId: string | null;
  reason: string | null;
  actorUserId: string | null;
  correlationId: string | null;
  occurredAt: string;
}

export interface Stay {
  id: string;
  status: StayStatus;
  checkedInAt: string;
  checkedOutAt: string | null;
  checkOutNotes: string | null;
  moveCount: number;
  guest: { id: string; fullName: string; email: string | null; phone: string | null };
  room: { id: string; number: string; floor: string | null; building: string | null };
  reservation: {
    id: string;
    code: string;
    status: ReservationStatus;
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    adults: number;
    children: number;
    notes: string | null;
    roomType: { id: string; name: string; code: string };
  };
}

export interface RoomRackItem {
  id: string;
  number: string;
  floor: string | null;
  building: string | null;
  roomType: { id: string; name: string; code: string };
  housekeepingState: HousekeepingState;
  operationalState: RoomOperationalState;
  occupancy: 'VACANT' | 'OCCUPIED';
  currentStay: {
    id: string;
    reservationId: string;
    code: string;
    guestName: string;
    checkOutDate: string;
  } | null;
  activeBlock: { id: string; type: string; endsAt: string } | null;
  nextArrival: {
    reservationId: string;
    code: string;
    guestName: string;
    checkInDate: string;
  } | null;
}

export interface FrontOfficeOverview {
  operationalDate: string;
  localDate: string;
  localTime: string;
  timezone: string;
  operationalDayStart: string;
  counts: {
    arrivals: number;
    departures: number;
    inHouse: number;
    noShowCandidates: number;
    vacantRooms: number;
    occupiedRooms: number;
  };
  arrivals: Reservation[];
  departures: Stay[];
  inHouse: Stay[];
  noShowCandidates: Reservation[];
  roomRack: RoomRackItem[];
}

export interface Incident {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  room: { id: string; number: string } | null;
  reservation: { id: string; code: string } | null;
  stay: { id: string; status: StayStatus } | null;
  createdBy: { id: string; name: string } | null;
  resolvedBy: { id: string; name: string } | null;
}

export interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  occurredAt: string;
  correlationId: string | null;
  reason: string | null;
  metadata: unknown;
}

export interface SecurityEvent {
  id: string;
  type: string;
  severity: SecuritySeverity;
  userId: string | null;
  actorUserId: string | null;
  occurredAt: string;
  correlationId: string | null;
  metadata: unknown;
}

export interface SessionSummary {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current?: boolean;
}

export interface Role {
  id: string;
  key: string;
  name: string;
  system: boolean;
  permissions: string[];
  membershipCount: number;
  propertyMembershipCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  id: string;
  organizationId: string;
  userId: string;
  roleId: string | null;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    status: RecordStatus;
    emailVerifiedAt: string | null;
  };
  role: {
    id: string;
    key: string;
    name: string;
    system: boolean;
    permissions: string[];
  } | null;
  propertyMemberships: Array<{
    id: string;
    userId: string;
    propertyId: string;
    roleId: string;
    status: RecordStatus;
    property: { id: string; name: string; code: string };
    role: { id: string; key: string; name: string };
  }>;
}

export interface PropertyMembership {
  id: string;
  userId: string;
  roleId: string;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; name: string; status: RecordStatus };
  role: { id: string; key: string; name: string; system: boolean };
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export type FolioStatus = 'OPEN' | 'SETTLED' | 'CANCELLED';
export type FolioLineStatus = 'POSTED' | 'VOID';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type CashSessionStatus = 'OPEN' | 'CLOSED';
export type CashMovementType = 'CASH_IN' | 'CASH_OUT' | 'REFUND' | 'ADJUSTMENT';
export type OperationalCloseStatus = 'CLOSED' | 'REOPENED';

export interface FolioLine {
  id: string;
  description: string;
  amount: string;
  currencyCode: string;
  status: FolioLineStatus;
  postedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  createdByUserId: string | null;
}

export interface FolioPayment {
  id: string;
  amount: string;
  currencyCode: string;
  method: string;
  status: PaymentStatus;
  referenceId: string | null;
  description: string | null;
  receivedByUserId: string | null;
  receivedAt: string;
}

export interface Folio {
  id: string;
  number: string;
  status: FolioStatus;
  currencyCode: string;
  stayId: string | null;
  reservationId: string | null;
  notes: string | null;
  openedByUserId: string | null;
  closedAt: string | null;
  totals: { charges: string; payments: string; balance: string };
  lines: FolioLine[];
  payments: FolioPayment[];
  createdAt: string;
  updatedAt: string;
}

export interface CashMovement {
  id: string;
  type: CashMovementType;
  amount: string;
  currencyCode: string;
  description: string | null;
  recordedByUserId: string | null;
  createdAt: string;
}

export interface CashSession {
  id: string;
  name: string;
  operationalDate: string;
  openingAmount: string;
  closingAmount: string | null;
  expectedCashAmount: string;
  status: CashSessionStatus;
  currencyCode: string;
  openingByUserId: string | null;
  openedAt: string;
  closedAt: string | null;
  closedByUserId: string | null;
  variance: string;
  movements: CashMovement[];
  createdAt: string;
  updatedAt: string;
}

export interface NightAuditBlocker {
  code: string;
  count: number;
  message: string;
}

export interface NightAuditSnapshot {
  generatedAt: string;
  operationalDate: string;
  timezone: string;
  operationalDayStart: string;
  currencyCode: string;
  counts: {
    openCashSessions: number;
    openFolios: number;
    confirmedArrivalsBeforeDate: number;
    inHousePastCheckout: number;
  };
  totals: { openFolioBalance: string };
  blockers: NightAuditBlocker[];
  forced: boolean;
}

export interface OperationalClose {
  id: string;
  operationalDate: string;
  status: OperationalCloseStatus;
  snapshot: NightAuditSnapshot;
  notes: string | null;
  closedByUserId: string | null;
  closedAt: string;
  reopenedByUserId: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  createdAt: string;
  updatedAt: string;
}
