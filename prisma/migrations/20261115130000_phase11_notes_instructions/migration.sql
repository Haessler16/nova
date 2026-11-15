-- Phase 11 — reservation notes, structured instructions, source notes and
-- persistent guest notes. Additive migration: existing Reservation.notes and
-- Guest.notes are preserved for compatibility.

-- CreateEnum
CREATE TYPE "InstructionCategory" AS ENUM ('PAYMENT', 'MEAL', 'BILLING', 'ROOM', 'ARRIVAL', 'IMPORTANT', 'EXTRA', 'CONFIDENTIAL', 'GENERAL');
CREATE TYPE "InstructionPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
CREATE TYPE "InstructionStatus" AS ENUM ('NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED', 'NEEDS_CLARIFICATION');
CREATE TYPE "InstructionSource" AS ENUM ('RESERVATIONS', 'FRONT_DESK', 'GUEST', 'CHANNEL', 'IMPORT', 'SYSTEM');
CREATE TYPE "InstructionVisibility" AS ENUM ('ALL_AUTHORIZED', 'FRONT_DESK', 'RESERVATIONS', 'FINANCE', 'MANAGEMENT');
CREATE TYPE "InstructionActionType" AS ENUM ('PAYMENT_PREAUTHORIZATION', 'VERIFY_PAYMENT', 'BILLING_TASK', 'ARRIVAL_REMINDER');
CREATE TYPE "InstructionExecutionMoment" AS ENUM ('PRE_ARRIVAL', 'CHECK_IN', 'DURING_STAY', 'CHECK_OUT');
CREATE TYPE "InstructionPaymentMethod" AS ENUM ('CREDIT_CARD', 'PIX', 'CASH', 'BANK_TRANSFER', 'UNKNOWN');
CREATE TYPE "InstructionEventType" AS ENUM ('CREATED', 'UPDATED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED', 'NEEDS_CLARIFICATION', 'CONFIRMED_FROM_SOURCE');

-- CreateTable
CREATE TABLE "ReservationSourceNote" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "sourceTextOriginal" TEXT NOT NULL,
    "sourceTextHash" VARCHAR(64) NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "parserVersion" VARCHAR(32) NOT NULL,
    "redacted" BOOLEAN NOT NULL DEFAULT false,
    "suggestions" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "sourceSystem" VARCHAR(64),
    "sourceDepartment" VARCHAR(64),
    "externalReference" VARCHAR(120),
    "importedByUserId" UUID,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationSourceNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReservationInstruction" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "sourceNoteId" UUID,
    "category" "InstructionCategory" NOT NULL DEFAULT 'GENERAL',
    "title" VARCHAR(160) NOT NULL,
    "body" TEXT NOT NULL,
    "priority" "InstructionPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "InstructionStatus" NOT NULL DEFAULT 'NEW',
    "source" "InstructionSource" NOT NULL DEFAULT 'RESERVATIONS',
    "sourceDepartment" VARCHAR(64),
    "visibility" "InstructionVisibility" NOT NULL DEFAULT 'ALL_AUTHORIZED',
    "assignedDepartment" VARCHAR(64),
    "assignedUserId" UUID,
    "actionType" "InstructionActionType",
    "executionMoment" "InstructionExecutionMoment",
    "paymentMethod" "InstructionPaymentMethod",
    "actionDueAt" TIMESTAMP(3),
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedByUserId" UUID,
    "createdByUserId" UUID,
    "dedupeKey" VARCHAR(64),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationInstruction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstructionEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "instructionId" UUID NOT NULL,
    "eventType" "InstructionEventType" NOT NULL,
    "actorUserId" UUID,
    "fromStatus" "InstructionStatus",
    "toStatus" "InstructionStatus",
    "reason" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstructionEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuestNote" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "category" "InstructionCategory" NOT NULL DEFAULT 'GENERAL',
    "body" TEXT NOT NULL,
    "priority" "InstructionPriority" NOT NULL DEFAULT 'NORMAL',
    "visibility" "InstructionVisibility" NOT NULL DEFAULT 'ALL_AUTHORIZED',
    "purpose" VARCHAR(64),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" UUID,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReservationSourceNote_content_version_key" ON "ReservationSourceNote"("reservationId", "contentHash", "parserVersion");
CREATE UNIQUE INDEX "ReservationSourceNote_organizationId_propertyId_id_key" ON "ReservationSourceNote"("organizationId", "propertyId", "id");
CREATE INDEX "ReservationSourceNote_reservation_imported_idx" ON "ReservationSourceNote"("organizationId", "propertyId", "reservationId", "importedAt");

CREATE UNIQUE INDEX "ReservationInstruction_organizationId_propertyId_id_key" ON "ReservationInstruction"("organizationId", "propertyId", "id");
CREATE UNIQUE INDEX "ReservationInstruction_sourceNoteId_dedupeKey_key" ON "ReservationInstruction"("sourceNoteId", "dedupeKey");
CREATE INDEX "ReservationInstruction_reservation_status_priority_idx" ON "ReservationInstruction"("organizationId", "propertyId", "reservationId", "status", "priority");
CREATE INDEX "ReservationInstruction_reservation_moment_idx" ON "ReservationInstruction"("organizationId", "propertyId", "reservationId", "executionMoment");
CREATE INDEX "ReservationInstruction_action_due_idx" ON "ReservationInstruction"("organizationId", "propertyId", "actionDueAt");
CREATE INDEX "ReservationInstruction_assigned_department_idx" ON "ReservationInstruction"("organizationId", "propertyId", "assignedDepartment", "status");

CREATE INDEX "InstructionEvent_instruction_occurred_idx" ON "InstructionEvent"("organizationId", "propertyId", "instructionId", "occurredAt");

CREATE UNIQUE INDEX "GuestNote_organizationId_propertyId_id_key" ON "GuestNote"("organizationId", "propertyId", "id");
CREATE INDEX "GuestNote_organizationId_propertyId_guestId_isActive_idx" ON "GuestNote"("organizationId", "propertyId", "guestId", "isActive");
CREATE INDEX "GuestNote_organizationId_propertyId_expiresAt_idx" ON "GuestNote"("organizationId", "propertyId", "expiresAt");

-- AddForeignKey
ALTER TABLE "ReservationSourceNote" ADD CONSTRAINT "ReservationSourceNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReservationSourceNote" ADD CONSTRAINT "ReservationSourceNote_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReservationSourceNote" ADD CONSTRAINT "ReservationSourceNote_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReservationSourceNote" ADD CONSTRAINT "ReservationSourceNote_importedByUserId_fkey" FOREIGN KEY ("importedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReservationInstruction" ADD CONSTRAINT "ReservationInstruction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReservationInstruction" ADD CONSTRAINT "ReservationInstruction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReservationInstruction" ADD CONSTRAINT "ReservationInstruction_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReservationInstruction" ADD CONSTRAINT "ReservationInstruction_sourceNoteId_fkey" FOREIGN KEY ("sourceNoteId") REFERENCES "ReservationSourceNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReservationInstruction" ADD CONSTRAINT "ReservationInstruction_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReservationInstruction" ADD CONSTRAINT "ReservationInstruction_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReservationInstruction" ADD CONSTRAINT "ReservationInstruction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InstructionEvent" ADD CONSTRAINT "InstructionEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InstructionEvent" ADD CONSTRAINT "InstructionEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InstructionEvent" ADD CONSTRAINT "InstructionEvent_instructionId_fkey" FOREIGN KEY ("instructionId") REFERENCES "ReservationInstruction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstructionEvent" ADD CONSTRAINT "InstructionEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GuestNote" ADD CONSTRAINT "GuestNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuestNote" ADD CONSTRAINT "GuestNote_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuestNote" ADD CONSTRAINT "GuestNote_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuestNote" ADD CONSTRAINT "GuestNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GuestNote" ADD CONSTRAINT "GuestNote_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Composite tenant foreign keys: a row cannot link a reservation, guest or
-- instruction from another organization/property.
ALTER TABLE "ReservationSourceNote"
ADD CONSTRAINT "ReservationSourceNote_property_tenant_fkey"
FOREIGN KEY ("organizationId", "propertyId") REFERENCES "Property"("organizationId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReservationSourceNote"
ADD CONSTRAINT "ReservationSourceNote_reservation_tenant_fkey"
FOREIGN KEY ("organizationId", "propertyId", "reservationId")
REFERENCES "Reservation"("organizationId", "propertyId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReservationInstruction"
ADD CONSTRAINT "ReservationInstruction_property_tenant_fkey"
FOREIGN KEY ("organizationId", "propertyId") REFERENCES "Property"("organizationId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReservationInstruction"
ADD CONSTRAINT "ReservationInstruction_reservation_tenant_fkey"
FOREIGN KEY ("organizationId", "propertyId", "reservationId")
REFERENCES "Reservation"("organizationId", "propertyId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReservationInstruction"
ADD CONSTRAINT "ReservationInstruction_source_note_tenant_fkey"
FOREIGN KEY ("organizationId", "propertyId", "sourceNoteId")
REFERENCES "ReservationSourceNote"("organizationId", "propertyId", "id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InstructionEvent"
ADD CONSTRAINT "InstructionEvent_property_tenant_fkey"
FOREIGN KEY ("organizationId", "propertyId") REFERENCES "Property"("organizationId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InstructionEvent"
ADD CONSTRAINT "InstructionEvent_instruction_tenant_fkey"
FOREIGN KEY ("organizationId", "propertyId", "instructionId")
REFERENCES "ReservationInstruction"("organizationId", "propertyId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuestNote"
ADD CONSTRAINT "GuestNote_property_tenant_fkey"
FOREIGN KEY ("organizationId", "propertyId") REFERENCES "Property"("organizationId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GuestNote"
ADD CONSTRAINT "GuestNote_guest_tenant_fkey"
FOREIGN KEY ("organizationId", "propertyId", "guestId")
REFERENCES "Guest"("organizationId", "propertyId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Source text is immutable: it is the audit-grade original (redacted for card
-- data before insert). Suggestions can only be produced at import time.
CREATE OR REPLACE FUNCTION "ReservationSourceNote_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ReservationSourceNote is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ReservationSourceNote_immutable_trigger"
BEFORE UPDATE OR DELETE ON "ReservationSourceNote"
FOR EACH ROW EXECUTE FUNCTION "ReservationSourceNote_immutable"();

-- Instruction events are append-only, like AuditEvent.
CREATE OR REPLACE FUNCTION "InstructionEvent_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'InstructionEvent is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "InstructionEvent_append_only_trigger"
BEFORE UPDATE OR DELETE ON "InstructionEvent"
FOR EACH ROW EXECUTE FUNCTION "InstructionEvent_append_only"();
