-- DropForeignKey
ALTER TABLE "AuditEvent" DROP CONSTRAINT "AuditEvent_property_tenant_fkey";

-- DropForeignKey
ALTER TABLE "Guest" DROP CONSTRAINT "Guest_property_tenant_fkey";

-- DropForeignKey
ALTER TABLE "Incident" DROP CONSTRAINT "Incident_tenant_reservation_fkey";

-- DropForeignKey
ALTER TABLE "Incident" DROP CONSTRAINT "Incident_tenant_room_fkey";

-- DropForeignKey
ALTER TABLE "Incident" DROP CONSTRAINT "Incident_tenant_stay_fkey";

-- DropForeignKey
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_role_tenant_fkey";

-- DropForeignKey
ALTER TABLE "PropertyMembership" DROP CONSTRAINT "PropertyMembership_membership_fkey";

-- DropForeignKey
ALTER TABLE "PropertyMembership" DROP CONSTRAINT "PropertyMembership_property_tenant_fkey";

-- DropForeignKey
ALTER TABLE "PropertyMembership" DROP CONSTRAINT "PropertyMembership_role_tenant_fkey";

-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_creator_membership_fkey";

-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_guest_tenant_fkey";

-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_property_tenant_fkey";

-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_room_tenant_fkey";

-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_room_type_tenant_fkey";

-- DropForeignKey
ALTER TABLE "ReservationHistory" DROP CONSTRAINT "ReservationHistory_actor_membership_fkey";

-- DropForeignKey
ALTER TABLE "ReservationHistory" DROP CONSTRAINT "ReservationHistory_property_tenant_fkey";

-- DropForeignKey
ALTER TABLE "ReservationHistory" DROP CONSTRAINT "ReservationHistory_reservation_tenant_fkey";

-- DropForeignKey
ALTER TABLE "Room" DROP CONSTRAINT "Room_property_tenant_fkey";

-- DropForeignKey
ALTER TABLE "Room" DROP CONSTRAINT "Room_room_type_tenant_fkey";

-- DropForeignKey
ALTER TABLE "RoomBlock" DROP CONSTRAINT "RoomBlock_creator_membership_fkey";

-- DropForeignKey
ALTER TABLE "RoomBlock" DROP CONSTRAINT "RoomBlock_property_tenant_fkey";

-- DropForeignKey
ALTER TABLE "RoomBlock" DROP CONSTRAINT "RoomBlock_room_tenant_fkey";

-- DropForeignKey
ALTER TABLE "RoomStatusHistory" DROP CONSTRAINT "RoomStatusHistory_actor_membership_fkey";

-- DropForeignKey
ALTER TABLE "RoomStatusHistory" DROP CONSTRAINT "RoomStatusHistory_block_tenant_fkey";

-- DropForeignKey
ALTER TABLE "RoomStatusHistory" DROP CONSTRAINT "RoomStatusHistory_property_tenant_fkey";

-- DropForeignKey
ALTER TABLE "RoomStatusHistory" DROP CONSTRAINT "RoomStatusHistory_room_tenant_fkey";

-- DropForeignKey
ALTER TABLE "RoomType" DROP CONSTRAINT "RoomType_property_tenant_fkey";

-- DropForeignKey
ALTER TABLE "Stay" DROP CONSTRAINT "Stay_tenant_guest_fkey";

-- DropForeignKey
ALTER TABLE "Stay" DROP CONSTRAINT "Stay_tenant_reservation_fkey";

-- DropForeignKey
ALTER TABLE "Stay" DROP CONSTRAINT "Stay_tenant_room_fkey";

-- CreateTable
CREATE TABLE "Folio" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "stayId" UUID,
    "reservationId" UUID,
    "number" VARCHAR(32) NOT NULL,
    "concept" VARCHAR(120) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "folioId" UUID,
    "stayId" UUID,
    "reservationId" UUID,
    "amount" DECIMAL(10,2) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "method" VARCHAR(32) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "referenceId" VARCHAR(64),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashSession" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "operationalDate" DATE NOT NULL,
    "openingAmount" DECIMAL(10,2) NOT NULL,
    "closingAmount" DECIMAL(10,2),
    "openingByUserId" UUID,
    "closedAt" TIMESTAMP(3),
    "closedByUserId" UUID,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "cashSessionId" UUID NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Folio_organizationId_propertyId_status_idx" ON "Folio"("organizationId", "propertyId", "status");

-- CreateIndex
CREATE INDEX "Folio_propertyId_stayId_idx" ON "Folio"("propertyId", "stayId");

-- CreateIndex
CREATE INDEX "Folio_propertyId_reservationId_idx" ON "Folio"("propertyId", "reservationId");

-- CreateIndex
CREATE INDEX "Folio_organizationId_propertyId_createdAt_idx" ON "Folio"("organizationId", "propertyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Folio_organizationId_propertyId_id_key" ON "Folio"("organizationId", "propertyId", "id");

-- CreateIndex
CREATE INDEX "Payment_organizationId_propertyId_status_idx" ON "Payment"("organizationId", "propertyId", "status");

-- CreateIndex
CREATE INDEX "Payment_folioId_idx" ON "Payment"("folioId");

-- CreateIndex
CREATE INDEX "Payment_stayId_idx" ON "Payment"("stayId");

-- CreateIndex
CREATE INDEX "Payment_reservationId_idx" ON "Payment"("reservationId");

-- CreateIndex
CREATE INDEX "Payment_organizationId_propertyId_createdAt_idx" ON "Payment"("organizationId", "propertyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_organizationId_propertyId_id_key" ON "Payment"("organizationId", "propertyId", "id");

-- CreateIndex
CREATE INDEX "CashSession_organizationId_propertyId_operationalDate_idx" ON "CashSession"("organizationId", "propertyId", "operationalDate");

-- CreateIndex
CREATE INDEX "CashSession_propertyId_status_idx" ON "CashSession"("propertyId", "status");

-- CreateIndex
CREATE INDEX "CashSession_organizationId_propertyId_createdAt_idx" ON "CashSession"("organizationId", "propertyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashSession_organizationId_propertyId_id_key" ON "CashSession"("organizationId", "propertyId", "id");

-- CreateIndex
CREATE INDEX "CashMovement_cashSessionId_idx" ON "CashMovement"("cashSessionId");

-- CreateIndex
CREATE INDEX "CashMovement_organizationId_propertyId_type_idx" ON "CashMovement"("organizationId", "propertyId", "type");

-- CreateIndex
CREATE INDEX "CashMovement_organizationId_propertyId_createdAt_idx" ON "CashMovement"("organizationId", "propertyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashMovement_organizationId_propertyId_id_key" ON "CashMovement"("organizationId", "propertyId", "id");

-- AddForeignKey
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Reservation_organizationId_propertyId_roomId_checkInDate_checkO" RENAME TO "Reservation_organizationId_propertyId_roomId_checkInDate_ch_idx";

-- RenameIndex
ALTER INDEX "ReservationHistory_organizationId_propertyId_reservationId_occu" RENAME TO "ReservationHistory_organizationId_propertyId_reservationId__idx";
