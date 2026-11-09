-- Phase 5 — Folio, cash and operational day hardening.
--
-- The first Phase 5 migration created a draft schema and, as a side effect of
-- `prisma migrate diff`, dropped composite tenant foreign keys from earlier
-- phases. This migration:
--   1. restores every dropped tenant constraint;
--   2. replaces the draft folio tables with the final model (header + lines);
--   3. adds idempotency, money/status checks and composite tenant FKs.
--
-- The draft Phase 5 tables were never used in production. Dropping them here
-- is intentional and keeps the model unambiguous.

-- ---------------------------------------------------------------------------
-- 1. Restore composite tenant constraints dropped by the draft migration.
-- ---------------------------------------------------------------------------

ALTER TABLE "PropertyMembership"
    ADD CONSTRAINT "PropertyMembership_property_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId")
    REFERENCES "Property"("organizationId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PropertyMembership"
    ADD CONSTRAINT "PropertyMembership_role_tenant_fkey"
    FOREIGN KEY ("organizationId", "roleId")
    REFERENCES "Role"("organizationId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PropertyMembership"
    ADD CONSTRAINT "PropertyMembership_membership_fkey"
    FOREIGN KEY ("organizationId", "userId")
    REFERENCES "Membership"("organizationId", "userId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuditEvent"
    ADD CONSTRAINT "AuditEvent_property_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId")
    REFERENCES "Property"("organizationId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Membership"
    ADD CONSTRAINT "Membership_role_tenant_fkey"
    FOREIGN KEY ("organizationId", "roleId")
    REFERENCES "Role"("organizationId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoomType"
    ADD CONSTRAINT "RoomType_property_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId")
    REFERENCES "Property"("organizationId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Room"
    ADD CONSTRAINT "Room_property_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId")
    REFERENCES "Property"("organizationId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Room"
    ADD CONSTRAINT "Room_room_type_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId", "roomTypeId")
    REFERENCES "RoomType"("organizationId", "propertyId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoomBlock"
    ADD CONSTRAINT "RoomBlock_property_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId")
    REFERENCES "Property"("organizationId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoomBlock"
    ADD CONSTRAINT "RoomBlock_room_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId", "roomId")
    REFERENCES "Room"("organizationId", "propertyId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoomBlock"
    ADD CONSTRAINT "RoomBlock_creator_membership_fkey"
    FOREIGN KEY ("organizationId", "createdByUserId")
    REFERENCES "Membership"("organizationId", "userId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoomStatusHistory"
    ADD CONSTRAINT "RoomStatusHistory_property_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId")
    REFERENCES "Property"("organizationId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoomStatusHistory"
    ADD CONSTRAINT "RoomStatusHistory_room_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId", "roomId")
    REFERENCES "Room"("organizationId", "propertyId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoomStatusHistory"
    ADD CONSTRAINT "RoomStatusHistory_block_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId", "roomBlockId")
    REFERENCES "RoomBlock"("organizationId", "propertyId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoomStatusHistory"
    ADD CONSTRAINT "RoomStatusHistory_actor_membership_fkey"
    FOREIGN KEY ("organizationId", "actorUserId")
    REFERENCES "Membership"("organizationId", "userId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Guest"
    ADD CONSTRAINT "Guest_property_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId")
    REFERENCES "Property"("organizationId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_property_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId")
    REFERENCES "Property"("organizationId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_guest_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId", "guestId")
    REFERENCES "Guest"("organizationId", "propertyId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_room_type_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId", "roomTypeId")
    REFERENCES "RoomType"("organizationId", "propertyId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_room_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId", "roomId")
    REFERENCES "Room"("organizationId", "propertyId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_creator_membership_fkey"
    FOREIGN KEY ("organizationId", "createdByUserId")
    REFERENCES "Membership"("organizationId", "userId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReservationHistory"
    ADD CONSTRAINT "ReservationHistory_property_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId")
    REFERENCES "Property"("organizationId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReservationHistory"
    ADD CONSTRAINT "ReservationHistory_reservation_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId", "reservationId")
    REFERENCES "Reservation"("organizationId", "propertyId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReservationHistory"
    ADD CONSTRAINT "ReservationHistory_actor_membership_fkey"
    FOREIGN KEY ("organizationId", "actorUserId")
    REFERENCES "Membership"("organizationId", "userId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Phase 4 constraints dropped by the draft migration.
ALTER TABLE "Stay"
    ADD CONSTRAINT "Stay_tenant_reservation_fkey"
    FOREIGN KEY ("organizationId", "propertyId", "reservationId")
    REFERENCES "Reservation"("organizationId", "propertyId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Stay"
    ADD CONSTRAINT "Stay_tenant_room_fkey"
    FOREIGN KEY ("organizationId", "propertyId", "roomId")
    REFERENCES "Room"("organizationId", "propertyId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Stay"
    ADD CONSTRAINT "Stay_tenant_guest_fkey"
    FOREIGN KEY ("organizationId", "propertyId", "guestId")
    REFERENCES "Guest"("organizationId", "propertyId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Incident"
    ADD CONSTRAINT "Incident_tenant_room_fkey"
    FOREIGN KEY ("organizationId", "propertyId", "roomId")
    REFERENCES "Room"("organizationId", "propertyId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Incident"
    ADD CONSTRAINT "Incident_tenant_reservation_fkey"
    FOREIGN KEY ("organizationId", "propertyId", "reservationId")
    REFERENCES "Reservation"("organizationId", "propertyId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Incident"
    ADD CONSTRAINT "Incident_tenant_stay_fkey"
    FOREIGN KEY ("organizationId", "propertyId", "stayId")
    REFERENCES "Stay"("organizationId", "propertyId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Replace the draft Phase 5 tables.
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS "CashMovement";
DROP TABLE IF EXISTS "Payment";
DROP TABLE IF EXISTS "Folio";
DROP TABLE IF EXISTS "CashSession";

CREATE TYPE "FolioStatus" AS ENUM ('OPEN', 'SETTLED', 'CANCELLED');
CREATE TYPE "FolioLineStatus" AS ENUM ('POSTED', 'VOID');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "CashMovementType" AS ENUM ('CASH_IN', 'CASH_OUT', 'REFUND', 'ADJUSTMENT');
CREATE TYPE "OperationalCloseStatus" AS ENUM ('CLOSED', 'REOPENED');

CREATE TABLE "Folio" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "stayId" UUID,
    "reservationId" UUID,
    "number" VARCHAR(32) NOT NULL,
    "status" "FolioStatus" NOT NULL DEFAULT 'OPEN',
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "notes" TEXT,
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "openedByUserId" UUID,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FolioLine" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "folioId" UUID NOT NULL,
    "description" VARCHAR(120) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "status" "FolioLineStatus" NOT NULL DEFAULT 'POSTED',
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FolioLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "folioId" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "method" VARCHAR(32) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "referenceId" VARCHAR(64),
    "description" TEXT,
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "receivedByUserId" UUID,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashSession" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "operationalDate" DATE NOT NULL,
    "openingAmount" DECIMAL(10,2) NOT NULL,
    "closingAmount" DECIMAL(10,2),
    "expectedCashAmount" DECIMAL(10,2),
    "openingByUserId" UUID,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedByUserId" UUID,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashMovement" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "cashSessionId" UUID NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "description" TEXT,
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "recordedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationalClose" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "operationalDate" DATE NOT NULL,
    "status" "OperationalCloseStatus" NOT NULL DEFAULT 'CLOSED',
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "notes" TEXT,
    "closedByUserId" UUID,
    "closedAt" TIMESTAMP(3) NOT NULL,
    "reopenedByUserId" UUID,
    "reopenedAt" TIMESTAMP(3),
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalClose_pkey" PRIMARY KEY ("id")
);

-- Indexes and unique keys.
CREATE UNIQUE INDEX "Folio_propertyId_number_key" ON "Folio"("propertyId", "number");
CREATE UNIQUE INDEX "Folio_propertyId_idempotencyKey_key" ON "Folio"("propertyId", "idempotencyKey");
CREATE UNIQUE INDEX "Folio_organizationId_propertyId_id_key" ON "Folio"("organizationId", "propertyId", "id");
CREATE INDEX "Folio_organizationId_propertyId_status_idx" ON "Folio"("organizationId", "propertyId", "status");
CREATE INDEX "Folio_organizationId_propertyId_createdAt_idx" ON "Folio"("organizationId", "propertyId", "createdAt");
CREATE INDEX "Folio_propertyId_stayId_idx" ON "Folio"("propertyId", "stayId");
CREATE INDEX "Folio_propertyId_reservationId_idx" ON "Folio"("propertyId", "reservationId");

CREATE UNIQUE INDEX "FolioLine_propertyId_idempotencyKey_key" ON "FolioLine"("propertyId", "idempotencyKey");
CREATE UNIQUE INDEX "FolioLine_organizationId_propertyId_id_key" ON "FolioLine"("organizationId", "propertyId", "id");
CREATE INDEX "FolioLine_organizationId_propertyId_folioId_status_idx" ON "FolioLine"("organizationId", "propertyId", "folioId", "status");
CREATE INDEX "FolioLine_organizationId_propertyId_createdAt_idx" ON "FolioLine"("organizationId", "propertyId", "createdAt");

CREATE UNIQUE INDEX "Payment_propertyId_idempotencyKey_key" ON "Payment"("propertyId", "idempotencyKey");
CREATE UNIQUE INDEX "Payment_organizationId_propertyId_id_key" ON "Payment"("organizationId", "propertyId", "id");
CREATE INDEX "Payment_organizationId_propertyId_status_idx" ON "Payment"("organizationId", "propertyId", "status");
CREATE INDEX "Payment_organizationId_propertyId_folioId_idx" ON "Payment"("organizationId", "propertyId", "folioId");
CREATE INDEX "Payment_organizationId_propertyId_createdAt_idx" ON "Payment"("organizationId", "propertyId", "createdAt");

CREATE UNIQUE INDEX "CashSession_propertyId_idempotencyKey_key" ON "CashSession"("propertyId", "idempotencyKey");
CREATE UNIQUE INDEX "CashSession_organizationId_propertyId_id_key" ON "CashSession"("organizationId", "propertyId", "id");
CREATE INDEX "CashSession_organizationId_propertyId_operationalDate_idx" ON "CashSession"("organizationId", "propertyId", "operationalDate");
CREATE INDEX "CashSession_organizationId_propertyId_status_idx" ON "CashSession"("organizationId", "propertyId", "status");
CREATE INDEX "CashSession_organizationId_propertyId_createdAt_idx" ON "CashSession"("organizationId", "propertyId", "createdAt");
-- A property can have at most one open cash session at a time.
CREATE UNIQUE INDEX "CashSession_one_open_per_property_key" ON "CashSession"("organizationId", "propertyId") WHERE "status" = 'OPEN';

CREATE UNIQUE INDEX "CashMovement_propertyId_idempotencyKey_key" ON "CashMovement"("propertyId", "idempotencyKey");
CREATE UNIQUE INDEX "CashMovement_organizationId_propertyId_id_key" ON "CashMovement"("organizationId", "propertyId", "id");
CREATE INDEX "CashMovement_organizationId_propertyId_cashSessionId_idx" ON "CashMovement"("organizationId", "propertyId", "cashSessionId");
CREATE INDEX "CashMovement_organizationId_propertyId_type_idx" ON "CashMovement"("organizationId", "propertyId", "type");
CREATE INDEX "CashMovement_organizationId_propertyId_createdAt_idx" ON "CashMovement"("organizationId", "propertyId", "createdAt");

CREATE UNIQUE INDEX "OperationalClose_organizationId_propertyId_operationalDate_key" ON "OperationalClose"("organizationId", "propertyId", "operationalDate");
CREATE UNIQUE INDEX "OperationalClose_propertyId_idempotencyKey_key" ON "OperationalClose"("propertyId", "idempotencyKey");
CREATE UNIQUE INDEX "OperationalClose_organizationId_propertyId_id_key" ON "OperationalClose"("organizationId", "propertyId", "id");
CREATE INDEX "OperationalClose_organizationId_propertyId_status_idx" ON "OperationalClose"("organizationId", "propertyId", "status");
CREATE INDEX "OperationalClose_organizationId_propertyId_createdAt_idx" ON "OperationalClose"("organizationId", "propertyId", "createdAt");

-- Single-column FKs generated by Prisma.
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FolioLine" ADD CONSTRAINT "FolioLine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FolioLine" ADD CONSTRAINT "FolioLine_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FolioLine" ADD CONSTRAINT "FolioLine_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FolioLine" ADD CONSTRAINT "FolioLine_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_openingByUserId_fkey" FOREIGN KEY ("openingByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OperationalClose" ADD CONSTRAINT "OperationalClose_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalClose" ADD CONSTRAINT "OperationalClose_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalClose" ADD CONSTRAINT "OperationalClose_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperationalClose" ADD CONSTRAINT "OperationalClose_reopenedByUserId_fkey" FOREIGN KEY ("reopenedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Composite tenant FKs: even a valid UUID cannot cross organization/property.
ALTER TABLE "Folio"
    ADD CONSTRAINT "Folio_property_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId")
    REFERENCES "Property"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Folio"
    ADD CONSTRAINT "Folio_tenant_stay_fkey"
    FOREIGN KEY ("organizationId", "propertyId", "stayId")
    REFERENCES "Stay"("organizationId", "propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Folio"
    ADD CONSTRAINT "Folio_tenant_reservation_fkey"
    FOREIGN KEY ("organizationId", "propertyId", "reservationId")
    REFERENCES "Reservation"("organizationId", "propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FolioLine"
    ADD CONSTRAINT "FolioLine_property_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId")
    REFERENCES "Property"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FolioLine"
    ADD CONSTRAINT "FolioLine_tenant_folio_fkey"
    FOREIGN KEY ("organizationId", "propertyId", "folioId")
    REFERENCES "Folio"("organizationId", "propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_property_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId")
    REFERENCES "Property"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_tenant_folio_fkey"
    FOREIGN KEY ("organizationId", "propertyId", "folioId")
    REFERENCES "Folio"("organizationId", "propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashSession"
    ADD CONSTRAINT "CashSession_property_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId")
    REFERENCES "Property"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashMovement"
    ADD CONSTRAINT "CashMovement_property_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId")
    REFERENCES "Property"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashMovement"
    ADD CONSTRAINT "CashMovement_tenant_cash_session_fkey"
    FOREIGN KEY ("organizationId", "propertyId", "cashSessionId")
    REFERENCES "CashSession"("organizationId", "propertyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OperationalClose"
    ADD CONSTRAINT "OperationalClose_property_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId")
    REFERENCES "Property"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data shape and financial invariants.
ALTER TABLE "Folio"
    ADD CONSTRAINT "Folio_number_check"
    CHECK (char_length("number") BETWEEN 1 AND 32 AND "number" = btrim("number"));

ALTER TABLE "Folio"
    ADD CONSTRAINT "Folio_currency_code_check"
    CHECK ("currencyCode" ~ '^[A-Z]{3}$');

ALTER TABLE "Folio"
    ADD CONSTRAINT "Folio_link_check"
    CHECK ("stayId" IS NOT NULL OR "reservationId" IS NOT NULL);

ALTER TABLE "Folio"
    ADD CONSTRAINT "Folio_idempotency_key_check"
    CHECK ("idempotencyKey" ~ '^[A-Za-z0-9._:-]{8,64}$');

ALTER TABLE "FolioLine"
    ADD CONSTRAINT "FolioLine_description_check"
    CHECK (char_length("description") BETWEEN 1 AND 120);

ALTER TABLE "FolioLine"
    ADD CONSTRAINT "FolioLine_amount_check"
    CHECK ("amount" > 0);

ALTER TABLE "FolioLine"
    ADD CONSTRAINT "FolioLine_currency_code_check"
    CHECK ("currencyCode" ~ '^[A-Z]{3}$');

ALTER TABLE "FolioLine"
    ADD CONSTRAINT "FolioLine_void_check"
    CHECK (
        ("status" = 'POSTED' AND "voidedAt" IS NULL AND "voidReason" IS NULL)
        OR ("status" = 'VOID' AND "voidedAt" IS NOT NULL AND "voidReason" IS NOT NULL)
    );

ALTER TABLE "FolioLine"
    ADD CONSTRAINT "FolioLine_idempotency_key_check"
    CHECK ("idempotencyKey" ~ '^[A-Za-z0-9._:-]{8,64}$');

ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_amount_check"
    CHECK ("amount" > 0);

ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_currency_code_check"
    CHECK ("currencyCode" ~ '^[A-Z]{3}$');

ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_method_check"
    CHECK ("method" ~ '^[A-Z][A-Z0-9_]{1,31}$');

ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_idempotency_key_check"
    CHECK ("idempotencyKey" ~ '^[A-Za-z0-9._:-]{8,64}$');

ALTER TABLE "CashSession"
    ADD CONSTRAINT "CashSession_name_check"
    CHECK (char_length("name") BETWEEN 1 AND 120);

ALTER TABLE "CashSession"
    ADD CONSTRAINT "CashSession_amount_check"
    CHECK ("openingAmount" >= 0 AND ("closingAmount" IS NULL OR "closingAmount" >= 0));

ALTER TABLE "CashSession"
    ADD CONSTRAINT "CashSession_close_check"
    CHECK (
        ("status" = 'OPEN' AND "closedAt" IS NULL AND "closedByUserId" IS NULL AND "closingAmount" IS NULL)
        OR ("status" = 'CLOSED' AND "closedAt" IS NOT NULL AND "closedByUserId" IS NOT NULL AND "closingAmount" IS NOT NULL)
    );

ALTER TABLE "CashSession"
    ADD CONSTRAINT "CashSession_idempotency_key_check"
    CHECK ("idempotencyKey" ~ '^[A-Za-z0-9._:-]{8,64}$');

ALTER TABLE "CashMovement"
    ADD CONSTRAINT "CashMovement_amount_check"
    CHECK ("amount" > 0);

ALTER TABLE "CashMovement"
    ADD CONSTRAINT "CashMovement_currency_code_check"
    CHECK ("currencyCode" ~ '^[A-Z]{3}$');

ALTER TABLE "CashMovement"
    ADD CONSTRAINT "CashMovement_idempotency_key_check"
    CHECK ("idempotencyKey" ~ '^[A-Za-z0-9._:-]{8,64}$');

ALTER TABLE "OperationalClose"
    ADD CONSTRAINT "OperationalClose_snapshot_check"
    CHECK (jsonb_typeof("snapshot") = 'object');

ALTER TABLE "OperationalClose"
    ADD CONSTRAINT "OperationalClose_reopen_check"
    CHECK (
        ("status" = 'REOPENED' AND "reopenedAt" IS NOT NULL AND "reopenReason" IS NOT NULL)
        OR ("status" = 'CLOSED' AND ("reopenedAt" IS NULL OR "reopenReason" IS NOT NULL))
    );

ALTER TABLE "OperationalClose"
    ADD CONSTRAINT "OperationalClose_idempotency_key_check"
    CHECK ("idempotencyKey" ~ '^[A-Za-z0-9._:-]{8,64}$');
