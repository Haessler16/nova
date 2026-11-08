-- CreateEnum
CREATE TYPE "HousekeepingState" AS ENUM ('DIRTY', 'CLEANING', 'CLEAN', 'INSPECTED');

-- CreateEnum
CREATE TYPE "RoomOperationalState" AS ENUM ('AVAILABLE', 'OUT_OF_ORDER', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "RoomBlockType" AS ENUM ('OUT_OF_ORDER', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "RoomBlockStatus" AS ENUM ('ACTIVE', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RoomStatusCategory" AS ENUM ('OPERATIONAL', 'HOUSEKEEPING');

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "roleId" UUID;

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomType" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "capacityAdults" INTEGER NOT NULL DEFAULT 1,
    "capacityChildren" INTEGER NOT NULL DEFAULT 0,
    "bedType" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomTypeId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "floor" TEXT,
    "building" TEXT,
    "attributes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "housekeepingState" "HousekeepingState" NOT NULL DEFAULT 'DIRTY',
    "operationalState" "RoomOperationalState" NOT NULL DEFAULT 'AVAILABLE',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomBlock" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "type" "RoomBlockType" NOT NULL,
    "status" "RoomBlockStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" UUID,
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomStatusHistory" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "roomBlockId" UUID,
    "category" "RoomStatusCategory" NOT NULL,
    "fromState" TEXT,
    "toState" TEXT NOT NULL,
    "reason" TEXT,
    "actorUserId" UUID,
    "correlationId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "RoomType_organizationId_propertyId_status_idx" ON "RoomType"("organizationId", "propertyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RoomType_propertyId_code_key" ON "RoomType"("propertyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "RoomType_organizationId_propertyId_id_key" ON "RoomType"("organizationId", "propertyId", "id");

-- CreateIndex
CREATE INDEX "Room_organizationId_propertyId_status_idx" ON "Room"("organizationId", "propertyId", "status");

-- CreateIndex
CREATE INDEX "Room_propertyId_roomTypeId_idx" ON "Room"("propertyId", "roomTypeId");

-- CreateIndex
CREATE INDEX "Room_propertyId_housekeepingState_idx" ON "Room"("propertyId", "housekeepingState");

-- CreateIndex
CREATE INDEX "Room_propertyId_operationalState_idx" ON "Room"("propertyId", "operationalState");

-- CreateIndex
CREATE UNIQUE INDEX "Room_propertyId_number_key" ON "Room"("propertyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Room_organizationId_propertyId_id_key" ON "Room"("organizationId", "propertyId", "id");

-- CreateIndex
CREATE INDEX "RoomBlock_organizationId_propertyId_status_startsAt_idx" ON "RoomBlock"("organizationId", "propertyId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "RoomBlock_roomId_status_startsAt_idx" ON "RoomBlock"("roomId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "RoomBlock_organizationId_createdByUserId_idx" ON "RoomBlock"("organizationId", "createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomBlock_organizationId_propertyId_id_key" ON "RoomBlock"("organizationId", "propertyId", "id");

-- CreateIndex
CREATE INDEX "RoomStatusHistory_organizationId_propertyId_occurredAt_idx" ON "RoomStatusHistory"("organizationId", "propertyId", "occurredAt");

-- CreateIndex
CREATE INDEX "RoomStatusHistory_roomId_occurredAt_idx" ON "RoomStatusHistory"("roomId", "occurredAt");

-- CreateIndex
CREATE INDEX "RoomStatusHistory_organizationId_propertyId_roomId_idx" ON "RoomStatusHistory"("organizationId", "propertyId", "roomId");

-- CreateIndex
CREATE INDEX "Membership_organizationId_roleId_idx" ON "Membership"("organizationId", "roleId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBlock" ADD CONSTRAINT "RoomBlock_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBlock" ADD CONSTRAINT "RoomBlock_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBlock" ADD CONSTRAINT "RoomBlock_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBlock" ADD CONSTRAINT "RoomBlock_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomStatusHistory" ADD CONSTRAINT "RoomStatusHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomStatusHistory" ADD CONSTRAINT "RoomStatusHistory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomStatusHistory" ADD CONSTRAINT "RoomStatusHistory_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomStatusHistory" ADD CONSTRAINT "RoomStatusHistory_roomBlockId_fkey" FOREIGN KEY ("roomBlockId") REFERENCES "RoomBlock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomStatusHistory" ADD CONSTRAINT "RoomStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- NOVA PMS — Phase 2 integrity hardening (manual SQL, not expressible in Prisma)
-- ---------------------------------------------------------------------------

-- btree_gist is required for the room-block overlap exclusion constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- An organization membership role must belong to the same organization.
ALTER TABLE "Membership"
    ADD CONSTRAINT "Membership_role_tenant_fkey"
    FOREIGN KEY ("organizationId", "roleId")
    REFERENCES "Role"("organizationId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Inventory rows must never mix organizations or properties.
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

-- Normalize and bound inventory configuration at the database boundary.
ALTER TABLE "Session"
    ADD CONSTRAINT "Session_token_hash_check"
    CHECK ("tokenHash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "Session"
    ADD CONSTRAINT "Session_expiry_check"
    CHECK ("expiresAt" > "createdAt");

ALTER TABLE "RoomType"
    ADD CONSTRAINT "RoomType_code_check"
    CHECK ("code" = upper("code") AND "code" ~ '^[A-Z0-9_-]{1,24}$');

ALTER TABLE "RoomType"
    ADD CONSTRAINT "RoomType_name_check"
    CHECK ("name" = btrim("name") AND length("name") BETWEEN 1 AND 120);

ALTER TABLE "RoomType"
    ADD CONSTRAINT "RoomType_capacity_check"
    CHECK ("capacityAdults" >= 1 AND "capacityChildren" >= 0);

ALTER TABLE "Room"
    ADD CONSTRAINT "Room_number_check"
    CHECK ("number" = btrim("number") AND length("number") BETWEEN 1 AND 32);

ALTER TABLE "Room"
    ADD CONSTRAINT "Room_attributes_count_check"
    CHECK (cardinality("attributes") <= 20);

ALTER TABLE "Room"
    ADD CONSTRAINT "Room_floor_check"
    CHECK ("floor" IS NULL OR length(btrim("floor")) BETWEEN 1 AND 32);

ALTER TABLE "Room"
    ADD CONSTRAINT "Room_building_check"
    CHECK ("building" IS NULL OR length(btrim("building")) BETWEEN 1 AND 64);

ALTER TABLE "RoomBlock"
    ADD CONSTRAINT "RoomBlock_reason_check"
    CHECK ("reason" = btrim("reason") AND length("reason") BETWEEN 3 AND 500);

ALTER TABLE "RoomBlock"
    ADD CONSTRAINT "RoomBlock_interval_check"
    CHECK ("endsAt" > "startsAt");

ALTER TABLE "RoomBlock"
    ADD CONSTRAINT "RoomBlock_release_reason_check"
    CHECK ("releaseReason" IS NULL OR length(btrim("releaseReason")) BETWEEN 3 AND 500);

ALTER TABLE "RoomBlock"
    ADD CONSTRAINT "RoomBlock_status_fields_check"
    CHECK (
        ("status" = 'ACTIVE' AND "releasedAt" IS NULL AND "releaseReason" IS NULL)
        OR ("status" <> 'ACTIVE' AND "releasedAt" IS NOT NULL)
    );

-- Two active blocks for the same room cannot overlap in time. This is a
-- database-level guarantee; application transactions also lock the room row
-- to produce a deterministic 409 instead of a raw constraint error.
ALTER TABLE "RoomBlock"
    ADD CONSTRAINT "RoomBlock_active_no_overlap"
    EXCLUDE USING gist (
        "roomId" WITH =,
        tsrange("startsAt", "endsAt", '[)') WITH &&
    )
    WHERE ("status" = 'ACTIVE');

ALTER TABLE "RoomStatusHistory"
    ADD CONSTRAINT "RoomStatusHistory_to_state_check"
    CHECK ("toState" = btrim("toState") AND length("toState") BETWEEN 1 AND 64);

ALTER TABLE "RoomStatusHistory"
    ADD CONSTRAINT "RoomStatusHistory_from_state_check"
    CHECK ("fromState" IS NULL OR ("fromState" = btrim("fromState") AND length("fromState") BETWEEN 1 AND 64));

ALTER TABLE "RoomStatusHistory"
    ADD CONSTRAINT "RoomStatusHistory_reason_check"
    CHECK ("reason" IS NULL OR length(btrim("reason")) BETWEEN 1 AND 500);

-- Append-only room state history: rejects UPDATE, DELETE and TRUNCATE.
CREATE OR REPLACE FUNCTION "nova_room_status_history_append_only"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'RoomStatusHistory is append-only (operation %)', TG_OP
        USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER "RoomStatusHistory_append_only_row"
    BEFORE UPDATE OR DELETE ON "RoomStatusHistory"
    FOR EACH ROW EXECUTE FUNCTION "nova_room_status_history_append_only"();

CREATE TRIGGER "RoomStatusHistory_append_only_truncate"
    BEFORE TRUNCATE ON "RoomStatusHistory"
    FOR EACH STATEMENT EXECUTE FUNCTION "nova_room_status_history_append_only"();
