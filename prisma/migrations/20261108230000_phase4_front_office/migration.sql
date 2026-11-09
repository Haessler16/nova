-- Phase 4 — Front Office: stays and operational incidents.
-- Occupancy is represented by an IN_HOUSE stay, not by housekeeping state.

CREATE TYPE "StayStatus" AS ENUM ('IN_HOUSE', 'CHECKED_OUT');
CREATE TYPE "IncidentType" AS ENUM ('NOTE', 'MAINTENANCE', 'COMPLAINT', 'SAFETY', 'OTHER');
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'RESOLVED');

ALTER TABLE "Reservation" ADD COLUMN "noShowAt" TIMESTAMP(3);

CREATE TABLE "Stay" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "status" "StayStatus" NOT NULL DEFAULT 'IN_HOUSE',
    "checkedInAt" TIMESTAMP(3) NOT NULL,
    "checkedInByUserId" UUID,
    "checkedOutAt" TIMESTAMP(3),
    "checkedOutByUserId" UUID,
    "checkOutNotes" TEXT,
    "moveCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Incident" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomId" UUID,
    "reservationId" UUID,
    "stayId" UUID,
    "type" "IncidentType" NOT NULL DEFAULT 'NOTE',
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "resolution" TEXT,
    "createdByUserId" UUID,
    "resolvedByUserId" UUID,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Stay_reservationId_key" ON "Stay"("reservationId");
CREATE UNIQUE INDEX "Stay_organizationId_propertyId_id_key" ON "Stay"("organizationId", "propertyId", "id");
CREATE INDEX "Stay_organizationId_propertyId_status_idx" ON "Stay"("organizationId", "propertyId", "status");
CREATE INDEX "Stay_propertyId_roomId_status_idx" ON "Stay"("propertyId", "roomId", "status");
CREATE INDEX "Stay_organizationId_guestId_idx" ON "Stay"("organizationId", "guestId");

CREATE UNIQUE INDEX "Incident_organizationId_propertyId_id_key" ON "Incident"("organizationId", "propertyId", "id");
CREATE INDEX "Incident_organizationId_propertyId_status_createdAt_idx" ON "Incident"("organizationId", "propertyId", "status", "createdAt");
CREATE INDEX "Incident_propertyId_roomId_status_idx" ON "Incident"("propertyId", "roomId", "status");
CREATE INDEX "Incident_organizationId_propertyId_reservationId_idx" ON "Incident"("organizationId", "propertyId", "reservationId");

ALTER TABLE "Stay" ADD CONSTRAINT "Stay_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_checkedInByUserId_fkey" FOREIGN KEY ("checkedInByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_checkedOutByUserId_fkey" FOREIGN KEY ("checkedOutByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Incident" ADD CONSTRAINT "Incident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Composite tenant foreign keys: a stay or incident can only reference rows
-- belonging to the same organization and property.
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_tenant_reservation_fkey" FOREIGN KEY ("organizationId", "propertyId", "reservationId") REFERENCES "Reservation"("organizationId", "propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_tenant_room_fkey" FOREIGN KEY ("organizationId", "propertyId", "roomId") REFERENCES "Room"("organizationId", "propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_tenant_guest_fkey" FOREIGN KEY ("organizationId", "propertyId", "guestId") REFERENCES "Guest"("organizationId", "propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Incident" ADD CONSTRAINT "Incident_tenant_room_fkey" FOREIGN KEY ("organizationId", "propertyId", "roomId") REFERENCES "Room"("organizationId", "propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_tenant_reservation_fkey" FOREIGN KEY ("organizationId", "propertyId", "reservationId") REFERENCES "Reservation"("organizationId", "propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_tenant_stay_fkey" FOREIGN KEY ("organizationId", "propertyId", "stayId") REFERENCES "Stay"("organizationId", "propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Stay" ADD CONSTRAINT "Stay_checkout_consistency" CHECK (
    ("status" = 'IN_HOUSE' AND "checkedOutAt" IS NULL)
    OR ("status" = 'CHECKED_OUT' AND "checkedOutAt" IS NOT NULL)
);
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_checkout_after_checkin" CHECK (
    "checkedOutAt" IS NULL OR "checkedOutAt" > "checkedInAt"
);
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_move_count_check" CHECK ("moveCount" >= 0);

ALTER TABLE "Incident" ADD CONSTRAINT "Incident_title_length" CHECK (char_length("title") BETWEEN 3 AND 120);
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_description_length" CHECK (char_length("description") BETWEEN 3 AND 4000);
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_resolution_length" CHECK (
    "resolution" IS NULL OR char_length("resolution") BETWEEN 3 AND 4000
);
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_resolved_consistency" CHECK (
    ("status" = 'OPEN' AND "resolvedAt" IS NULL)
    OR ("status" = 'RESOLVED' AND "resolvedAt" IS NOT NULL)
);
