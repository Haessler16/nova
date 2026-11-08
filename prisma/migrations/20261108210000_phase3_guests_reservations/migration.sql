-- CreateEnum
CREATE TYPE "GuestDocumentType" AS ENUM ('PASSPORT', 'NATIONAL_ID', 'DRIVER_LICENSE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "Guest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "documentType" "GuestDocumentType",
    "documentNumber" TEXT,
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "source" VARCHAR(32),
    "checkInDate" DATE NOT NULL,
    "checkOutDate" DATE NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "guestId" UUID NOT NULL,
    "roomTypeId" UUID NOT NULL,
    "roomId" UUID,
    "notes" TEXT,
    "idempotencyKey" VARCHAR(64),
    "createdByUserId" UUID,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationHistory" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "ReservationStatus",
    "toStatus" "ReservationStatus",
    "fromRoomId" UUID,
    "toRoomId" UUID,
    "reason" TEXT,
    "actorUserId" UUID,
    "correlationId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Guest_organizationId_propertyId_id_key" ON "Guest"("organizationId", "propertyId", "id");

-- CreateIndex
CREATE INDEX "Guest_organizationId_propertyId_status_idx" ON "Guest"("organizationId", "propertyId", "status");

-- CreateIndex
CREATE INDEX "Guest_organizationId_propertyId_fullName_idx" ON "Guest"("organizationId", "propertyId", "fullName");

-- CreateIndex
CREATE INDEX "Guest_organizationId_propertyId_email_idx" ON "Guest"("organizationId", "propertyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_propertyId_code_key" ON "Reservation"("propertyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_propertyId_idempotencyKey_key" ON "Reservation"("propertyId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_organizationId_propertyId_id_key" ON "Reservation"("organizationId", "propertyId", "id");

-- CreateIndex
CREATE INDEX "Reservation_organizationId_propertyId_status_checkInDate_idx" ON "Reservation"("organizationId", "propertyId", "status", "checkInDate");

-- CreateIndex
CREATE INDEX "Reservation_organizationId_propertyId_roomId_checkInDate_checkOutDate_idx" ON "Reservation"("organizationId", "propertyId", "roomId", "checkInDate", "checkOutDate");

-- CreateIndex
CREATE INDEX "Reservation_organizationId_propertyId_guestId_idx" ON "Reservation"("organizationId", "propertyId", "guestId");

-- CreateIndex
CREATE INDEX "ReservationHistory_organizationId_propertyId_reservationId_occurredAt_idx" ON "ReservationHistory"("organizationId", "propertyId", "reservationId", "occurredAt");

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationHistory" ADD CONSTRAINT "ReservationHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationHistory" ADD CONSTRAINT "ReservationHistory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationHistory" ADD CONSTRAINT "ReservationHistory_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationHistory" ADD CONSTRAINT "ReservationHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- NOVA PMS — Guests and reservations (manual SQL)
-- ---------------------------------------------------------------------------

-- Composite tenant foreign keys: a guest, reservation or history row can never
-- reference another organization/property even if a single id is valid.
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

-- Data minimization and format checks. Guest documents are optional and only
-- stored when both type and number are present.
ALTER TABLE "Guest"
    ADD CONSTRAINT "Guest_full_name_check"
    CHECK ("fullName" = btrim("fullName") AND length("fullName") BETWEEN 2 AND 160);

ALTER TABLE "Guest"
    ADD CONSTRAINT "Guest_email_check"
    CHECK (
        "email" IS NULL
        OR (
            "email" = lower("email")
            AND length("email") <= 254
            AND "email" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
        )
    );

ALTER TABLE "Guest"
    ADD CONSTRAINT "Guest_phone_check"
    CHECK ("phone" IS NULL OR "phone" ~ '^\+?[0-9 ()-]{6,32}$');

ALTER TABLE "Guest"
    ADD CONSTRAINT "Guest_document_check"
    CHECK (("documentType" IS NULL) = ("documentNumber" IS NULL));

ALTER TABLE "Guest"
    ADD CONSTRAINT "Guest_document_number_check"
    CHECK (
        "documentNumber" IS NULL
        OR ("documentNumber" = btrim("documentNumber") AND length("documentNumber") BETWEEN 3 AND 64)
    );

ALTER TABLE "Guest"
    ADD CONSTRAINT "Guest_notes_check"
    CHECK ("notes" IS NULL OR length("notes") <= 2000);

ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_code_check"
    CHECK ("code" = upper("code") AND "code" ~ '^[A-Z0-9-]{4,32}$');

ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_date_order_check"
    CHECK ("checkOutDate" > "checkInDate");

ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_occupancy_check"
    CHECK (
        "adults" BETWEEN 1 AND 20
        AND "children" BETWEEN 0 AND 20
        AND ("adults" + "children") BETWEEN 1 AND 24
    );

ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_source_check"
    CHECK ("source" IS NULL OR ("source" = btrim("source") AND length("source") BETWEEN 1 AND 32));

ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_notes_check"
    CHECK ("notes" IS NULL OR length("notes") <= 2000);

ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_idempotency_key_check"
    CHECK ("idempotencyKey" IS NULL OR "idempotencyKey" ~ '^[A-Za-z0-9._:-]{8,64}$');

ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_cancellation_fields_check"
    CHECK (
        ("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL)
        AND ("cancellationReason" IS NULL OR "cancelledAt" IS NOT NULL)
    );

ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_cancellation_reason_check"
    CHECK (
        "cancellationReason" IS NULL
        OR ("cancellationReason" = btrim("cancellationReason") AND length("cancellationReason") BETWEEN 3 AND 500)
    );

-- Final authority against double booking: an active (non-cancelled) room
-- assignment cannot overlap another active assignment for the same room.
-- The application also locks the room row and checks under READ COMMITTED.
ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_room_date_no_overlap"
    EXCLUDE USING gist (
        "roomId" WITH =,
        daterange("checkInDate", "checkOutDate", '[)') WITH &&
    )
    WHERE ("roomId" IS NOT NULL AND "status" IN ('CONFIRMED', 'CHECKED_IN'));

ALTER TABLE "ReservationHistory"
    ADD CONSTRAINT "ReservationHistory_action_check"
    CHECK ("action" ~ '^reservation\.[a-z_]{3,40}$');

ALTER TABLE "ReservationHistory"
    ADD CONSTRAINT "ReservationHistory_reason_check"
    CHECK ("reason" IS NULL OR length("reason") <= 500);

ALTER TABLE "ReservationHistory"
    ADD CONSTRAINT "ReservationHistory_room_change_check"
    CHECK ("action" <> 'reservation.room_assigned' OR "toRoomId" IS NOT NULL);

-- Append-only reservation trail: rejects UPDATE, DELETE and TRUNCATE.
CREATE OR REPLACE FUNCTION "nova_reservation_history_append_only"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'ReservationHistory is append-only (operation %)', TG_OP
        USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER "ReservationHistory_append_only_row"
    BEFORE UPDATE OR DELETE ON "ReservationHistory"
    FOR EACH ROW EXECUTE FUNCTION "nova_reservation_history_append_only"();

CREATE TRIGGER "ReservationHistory_append_only_truncate"
    BEFORE TRUNCATE ON "ReservationHistory"
    FOR EACH STATEMENT EXECUTE FUNCTION "nova_reservation_history_append_only"();
