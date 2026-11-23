import { Prisma } from '@prisma/client';

export const INSTRUCTION_SELECT = {
  id: true,
  organizationId: true,
  propertyId: true,
  reservationId: true,
  sourceNoteId: true,
  category: true,
  title: true,
  body: true,
  tags: true,
  priority: true,
  status: true,
  source: true,
  sourceDepartment: true,
  visibility: true,
  assignedDepartment: true,
  assignedUserId: true,
  actionType: true,
  executionMoment: true,
  paymentMethod: true,
  actionDueAt: true,
  validFrom: true,
  validUntil: true,
  completedAt: true,
  completedByUserId: true,
  createdByUserId: true,
  dedupeKey: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const SOURCE_NOTE_SELECT = {
  id: true,
  organizationId: true,
  propertyId: true,
  reservationId: true,
  sourceTextOriginal: true,
  sourceTextHash: true,
  contentHash: true,
  parserVersion: true,
  redacted: true,
  suggestions: true,
  warnings: true,
  sourceSystem: true,
  sourceDepartment: true,
  externalReference: true,
  importedByUserId: true,
  importedAt: true,
} as const;

export const GUEST_NOTE_SELECT = {
  id: true,
  organizationId: true,
  propertyId: true,
  guestId: true,
  category: true,
  body: true,
  priority: true,
  visibility: true,
  purpose: true,
  expiresAt: true,
  isActive: true,
  createdByUserId: true,
  updatedByUserId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type InstructionRow = Prisma.ReservationInstructionGetPayload<{
  select: typeof INSTRUCTION_SELECT;
}>;
export type SourceNoteRow = Prisma.ReservationSourceNoteGetPayload<{
  select: typeof SOURCE_NOTE_SELECT;
}>;
export type GuestNoteRow = Prisma.GuestNoteGetPayload<{ select: typeof GUEST_NOTE_SELECT }>;
