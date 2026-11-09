-- Phase 7: idempotency header for confirmed guest CSV imports.
-- Personal data stays in Guest; this table never stores the CSV or its rows.

CREATE TABLE "GuestImport" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "createdCount" INTEGER NOT NULL,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestImport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GuestImport_row_count_check" CHECK ("rowCount" BETWEEN 1 AND 500),
    CONSTRAINT "GuestImport_created_count_check" CHECK ("createdCount" = "rowCount"),
    CONSTRAINT "GuestImport_idempotency_key_check" CHECK ("idempotencyKey" ~ '^[A-Za-z0-9_-]{8,64}$')
);

CREATE UNIQUE INDEX "GuestImport_propertyId_idempotencyKey_key"
    ON "GuestImport"("propertyId", "idempotencyKey");

CREATE UNIQUE INDEX "GuestImport_organizationId_propertyId_id_key"
    ON "GuestImport"("organizationId", "propertyId", "id");

CREATE INDEX "GuestImport_organizationId_propertyId_createdAt_idx"
    ON "GuestImport"("organizationId", "propertyId", "createdAt");

ALTER TABLE "GuestImport"
    ADD CONSTRAINT "GuestImport_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GuestImport"
    ADD CONSTRAINT "GuestImport_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GuestImport"
    ADD CONSTRAINT "GuestImport_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GuestImport"
    ADD CONSTRAINT "GuestImport_property_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId") REFERENCES "Property"("organizationId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GuestImport"
    ADD CONSTRAINT "GuestImport_creator_membership_fkey"
    FOREIGN KEY ("organizationId", "createdByUserId") REFERENCES "Membership"("organizationId", "userId")
    ON DELETE RESTRICT ON UPDATE CASCADE;
