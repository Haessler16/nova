-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('GENERATED', 'SIGNATURE_RECEIVED', 'VOIDED');

-- CreateEnum
CREATE TYPE "DocumentPrintEventType" AS ENUM ('PRINT_DIALOG_OPENED', 'PRINT_CONFIRMED_BY_STAFF', 'REPRINT_REQUESTED');

-- Reconcile pre-existing schema drift: Payment.reservationId/stayId were in schema but absent from migration history.
-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "reservationId" UUID,
ADD COLUMN     "stayId" UUID;

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
    "version" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedDocument" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "number" VARCHAR(48) NOT NULL,
    "documentType" VARCHAR(64) NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'GENERATED',
    "locale" VARCHAR(10) NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "guestId" UUID,
    "reservationId" UUID,
    "stayId" UUID,
    "folioId" UUID,
    "generatedById" UUID,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,
    "content" BYTEA NOT NULL,
    "mimeType" VARCHAR(80) NOT NULL DEFAULT 'application/pdf',
    "fileSizeBytes" INTEGER NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "storageKey" VARCHAR(160) NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "receivedById" UUID,
    "receivedNotes" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentPrintEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "type" "DocumentPrintEventType" NOT NULL,
    "requestedById" UUID,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "DocumentPrintEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentTemplate_organizationId_propertyId_key_locale_isPub_idx" ON "DocumentTemplate"("organizationId", "propertyId", "key", "locale", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_propertyId_key_locale_version_key" ON "DocumentTemplate"("propertyId", "key", "locale", "version");

-- CreateIndex
CREATE INDEX "GeneratedDocument_organizationId_propertyId_reservationId_g_idx" ON "GeneratedDocument"("organizationId", "propertyId", "reservationId", "generatedAt");

-- CreateIndex
CREATE INDEX "GeneratedDocument_organizationId_propertyId_guestId_generat_idx" ON "GeneratedDocument"("organizationId", "propertyId", "guestId", "generatedAt");

-- CreateIndex
CREATE INDEX "GeneratedDocument_organizationId_propertyId_documentType_ge_idx" ON "GeneratedDocument"("organizationId", "propertyId", "documentType", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedDocument_propertyId_number_key" ON "GeneratedDocument"("propertyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedDocument_organizationId_propertyId_id_key" ON "GeneratedDocument"("organizationId", "propertyId", "id");

-- CreateIndex
CREATE INDEX "DocumentPrintEvent_organizationId_propertyId_documentId_req_idx" ON "DocumentPrintEvent"("organizationId", "propertyId", "documentId", "requestedAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPrintEvent" ADD CONSTRAINT "DocumentPrintEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPrintEvent" ADD CONSTRAINT "DocumentPrintEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPrintEvent" ADD CONSTRAINT "DocumentPrintEvent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "GeneratedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPrintEvent" ADD CONSTRAINT "DocumentPrintEvent_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Composite tenant foreign keys: the database also rejects links that mix
-- organization/property, not only the service query filters.
ALTER TABLE "DocumentTemplate"
ADD CONSTRAINT "DocumentTemplate_property_tenant_fkey"
FOREIGN KEY ("organizationId", "propertyId") REFERENCES "Property"("organizationId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GeneratedDocument"
ADD CONSTRAINT "GeneratedDocument_property_tenant_fkey"
FOREIGN KEY ("organizationId", "propertyId") REFERENCES "Property"("organizationId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GeneratedDocument"
ADD CONSTRAINT "GeneratedDocument_guest_tenant_fkey"
FOREIGN KEY ("organizationId", "propertyId", "guestId")
REFERENCES "Guest"("organizationId", "propertyId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GeneratedDocument"
ADD CONSTRAINT "GeneratedDocument_reservation_tenant_fkey"
FOREIGN KEY ("organizationId", "propertyId", "reservationId")
REFERENCES "Reservation"("organizationId", "propertyId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GeneratedDocument"
ADD CONSTRAINT "GeneratedDocument_stay_tenant_fkey"
FOREIGN KEY ("organizationId", "propertyId", "stayId")
REFERENCES "Stay"("organizationId", "propertyId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GeneratedDocument"
ADD CONSTRAINT "GeneratedDocument_folio_tenant_fkey"
FOREIGN KEY ("organizationId", "propertyId", "folioId")
REFERENCES "Folio"("organizationId", "propertyId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DocumentPrintEvent"
ADD CONSTRAINT "DocumentPrintEvent_property_tenant_fkey"
FOREIGN KEY ("organizationId", "propertyId") REFERENCES "Property"("organizationId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DocumentPrintEvent"
ADD CONSTRAINT "DocumentPrintEvent_document_tenant_fkey"
FOREIGN KEY ("organizationId", "propertyId", "documentId")
REFERENCES "GeneratedDocument"("organizationId", "propertyId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Document print events are append-only, like AuditEvent. Never rewrite or
-- delete a print request; add a new event instead.
CREATE OR REPLACE FUNCTION "DocumentPrintEvent_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'DocumentPrintEvent is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "DocumentPrintEvent_append_only_trigger"
BEFORE UPDATE OR DELETE ON "DocumentPrintEvent"
FOR EACH ROW EXECUTE FUNCTION "DocumentPrintEvent_append_only"();

-- The emitted payload and snapshot are immutable. Only workflow fields such as
-- status, receivedAt/receivedBy and notes may change after generation.
CREATE OR REPLACE FUNCTION "GeneratedDocument_immutable"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'GeneratedDocument is immutable';
  END IF;
  IF OLD."number" IS DISTINCT FROM NEW."number"
    OR OLD."documentType" IS DISTINCT FROM NEW."documentType"
    OR OLD."locale" IS DISTINCT FROM NEW."locale"
    OR OLD."templateVersion" IS DISTINCT FROM NEW."templateVersion"
    OR OLD."snapshot" IS DISTINCT FROM NEW."snapshot"
    OR OLD."content" IS DISTINCT FROM NEW."content"
    OR OLD."mimeType" IS DISTINCT FROM NEW."mimeType"
    OR OLD."fileSizeBytes" IS DISTINCT FROM NEW."fileSizeBytes"
    OR OLD."pageCount" IS DISTINCT FROM NEW."pageCount"
    OR OLD."sha256" IS DISTINCT FROM NEW."sha256"
    OR OLD."storageKey" IS DISTINCT FROM NEW."storageKey"
  THEN
    RAISE EXCEPTION 'GeneratedDocument is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GeneratedDocument_immutable_trigger"
BEFORE UPDATE OR DELETE ON "GeneratedDocument"
FOR EACH ROW EXECUTE FUNCTION "GeneratedDocument_immutable"();
