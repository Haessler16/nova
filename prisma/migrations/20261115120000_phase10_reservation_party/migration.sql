-- Phase 10 — reservation party for guests, companions and minors.
-- Additive only: Reservation.guestId remains the canonical primary guest and
-- Stay remains the occupancy source. No FNRH network calls are made here.

-- CreateEnum
CREATE TYPE "ReservationGuestRole" AS ENUM ('PRIMARY', 'COMPANION');

-- CreateEnum
CREATE TYPE "GuestAgeGroup" AS ENUM ('ADULT', 'MINOR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ReservationGuestOrigin" AS ENUM ('LEGACY_BACKFILL', 'MANUAL', 'PRE_CHECKIN', 'IMPORT');

-- CreateEnum
CREATE TYPE "MinorSupervision" AS ENUM ('ACCOMPANIED', 'UNACCOMPANIED_AUTHORIZED', 'UNACCOMPANIED_WITHOUT_AUTHORIZATION', 'UNKNOWN');

-- AlterEnum
ALTER TYPE "GuestDocumentType" ADD VALUE 'CPF';
ALTER TYPE "GuestDocumentType" ADD VALUE 'RG';

-- CreateTable
CREATE TABLE "GuestFnrhProfile" (
    "guestId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "socialName" TEXT,
    "birthDate" DATE,
    "nationalityCountryCode" VARCHAR(2),
    "residenceCountryCode" VARCHAR(2),
    "genderCode" VARCHAR(32),
    "raceCode" VARCHAR(32),
    "disabilityCode" VARCHAR(32),
    "disabilityTypeCode" VARCHAR(32),
    "postalCode" VARCHAR(16),
    "street" VARCHAR(160),
    "number" VARCHAR(20),
    "complement" VARCHAR(80),
    "district" VARCHAR(80),
    "cityIbgeCode" VARCHAR(7),
    "cityName" VARCHAR(120),
    "stateCode" VARCHAR(2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestFnrhProfile_pkey" PRIMARY KEY ("guestId")
);

-- CreateTable
CREATE TABLE "ReservationGuest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "role" "ReservationGuestRole" NOT NULL,
    "ageGroup" "GuestAgeGroup" NOT NULL DEFAULT 'UNKNOWN',
    "legalIncapacity" BOOLEAN NOT NULL DEFAULT false,
    "minorSupervision" "MinorSupervision",
    "authorizationReference" VARCHAR(120),
    "origin" "ReservationGuestOrigin" NOT NULL DEFAULT 'MANUAL',
    "responsibleReservationGuestId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationGuest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuestFnrhProfile_organizationId_propertyId_idx" ON "GuestFnrhProfile"("organizationId", "propertyId");

-- CreateIndex
CREATE INDEX "ReservationGuest_organizationId_propertyId_reservationId_idx" ON "ReservationGuest"("organizationId", "propertyId", "reservationId");

-- CreateIndex
CREATE INDEX "ReservationGuest_organizationId_propertyId_guestId_idx" ON "ReservationGuest"("organizationId", "propertyId", "guestId");

-- CreateIndex
CREATE INDEX "ReservationGuest_responsibleReservationGuestId_idx" ON "ReservationGuest"("responsibleReservationGuestId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationGuest_reservationId_guestId_key" ON "ReservationGuest"("reservationId", "guestId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationGuest_organizationId_propertyId_id_key" ON "ReservationGuest"("organizationId", "propertyId", "id");

-- AddForeignKey
ALTER TABLE "GuestFnrhProfile" ADD CONSTRAINT "GuestFnrhProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestFnrhProfile" ADD CONSTRAINT "GuestFnrhProfile_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestFnrhProfile" ADD CONSTRAINT "GuestFnrhProfile_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationGuest" ADD CONSTRAINT "ReservationGuest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationGuest" ADD CONSTRAINT "ReservationGuest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationGuest" ADD CONSTRAINT "ReservationGuest_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationGuest" ADD CONSTRAINT "ReservationGuest_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationGuest" ADD CONSTRAINT "ReservationGuest_responsibleReservationGuestId_fkey" FOREIGN KEY ("responsibleReservationGuestId") REFERENCES "ReservationGuest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One primary row per reservation. The application keeps it aligned with
-- Reservation.guestId; this index prevents duplicates but not a mismatch.
CREATE UNIQUE INDEX "ReservationGuest_one_primary_per_reservation"
    ON "ReservationGuest"("reservationId")
    WHERE "role" = 'PRIMARY';

-- Backfill exactly one legacy primary per existing reservation. No companion
-- or minor identities are invented; ageGroup stays UNKNOWN and readiness
-- remains incomplete until staff captures real data.
INSERT INTO "ReservationGuest" (
    "id", "organizationId", "propertyId", "reservationId", "guestId",
    "role", "ageGroup", "origin", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid(),
    r."organizationId",
    r."propertyId",
    r."id",
    r."guestId",
    'PRIMARY',
    'UNKNOWN',
    'LEGACY_BACKFILL',
    now(),
    now()
FROM "Reservation" r
ON CONFLICT ("reservationId", "guestId") DO NOTHING;
