-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INVITED', 'DISABLED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "operationalDayStart" TEXT NOT NULL DEFAULT '06:00',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "PropertyMembership" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID,
    "actorUserId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlationId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE INDEX "Property_organizationId_status_idx" ON "Property"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Property_organizationId_code_key" ON "Property"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Property_organizationId_id_key" ON "Property"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "Membership_userId_status_idx" ON "Membership"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_organizationId_userId_key" ON "Membership"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_organizationId_key_key" ON "Role"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Role_organizationId_id_key" ON "Role"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "PropertyMembership_organizationId_userId_status_idx" ON "PropertyMembership"("organizationId", "userId", "status");

-- CreateIndex
CREATE INDEX "PropertyMembership_organizationId_propertyId_status_idx" ON "PropertyMembership"("organizationId", "propertyId", "status");

-- CreateIndex
CREATE INDEX "PropertyMembership_propertyId_status_idx" ON "PropertyMembership"("propertyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyMembership_propertyId_userId_key" ON "PropertyMembership"("propertyId", "userId");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_occurredAt_idx" ON "AuditEvent"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_propertyId_occurredAt_idx" ON "AuditEvent"("propertyId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMembership" ADD CONSTRAINT "PropertyMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMembership" ADD CONSTRAINT "PropertyMembership_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMembership" ADD CONSTRAINT "PropertyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMembership" ADD CONSTRAINT "PropertyMembership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- NOVA PMS — Phase 1 integrity hardening (manual SQL, not expressible in Prisma)
-- ---------------------------------------------------------------------------

-- A PropertyMembership may only reference a property, role and organization
-- membership from the SAME organization. Prisma's single-column relations do
-- not prevent cross-tenant references on their own.
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

-- Audit events attached to a property must belong to the same organization.
ALTER TABLE "AuditEvent"
    ADD CONSTRAINT "AuditEvent_property_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId")
    REFERENCES "Property"("organizationId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Normalize identity and configuration at the database boundary.
ALTER TABLE "User"
    ADD CONSTRAINT "User_email_normalized_check"
    CHECK ("email" = lower("email") AND "email" = btrim("email") AND position('@' IN "email") > 1);

ALTER TABLE "Property"
    ADD CONSTRAINT "Property_currency_code_check"
    CHECK ("currencyCode" ~ '^[A-Z]{3}$');

ALTER TABLE "Property"
    ADD CONSTRAINT "Property_operational_day_start_check"
    CHECK ("operationalDayStart" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "Property"
    ADD CONSTRAINT "Property_timezone_not_blank_check"
    CHECK (length(btrim("timezone")) > 0);

-- Keep audit payloads bounded even if a future code path bypasses AuditService.
ALTER TABLE "AuditEvent"
    ADD CONSTRAINT "AuditEvent_metadata_size_check"
    CHECK ("metadata" IS NULL OR pg_column_size("metadata") <= 8192);

-- Append-only audit log: rejects UPDATE, DELETE and TRUNCATE at the database
-- layer, in addition to the absence of mutating HTTP endpoints.
CREATE OR REPLACE FUNCTION "nova_audit_event_append_only"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'AuditEvent is append-only (operation %)', TG_OP
        USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER "AuditEvent_append_only_row"
    BEFORE UPDATE OR DELETE ON "AuditEvent"
    FOR EACH ROW EXECUTE FUNCTION "nova_audit_event_append_only"();

CREATE TRIGGER "AuditEvent_append_only_truncate"
    BEFORE TRUNCATE ON "AuditEvent"
    FOR EACH STATEMENT EXECUTE FUNCTION "nova_audit_event_append_only"();
