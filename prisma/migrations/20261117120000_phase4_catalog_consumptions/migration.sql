-- Phase 4 (v4) — property consumables catalog + folio line snapshots.
-- Additive only: no existing table is rewritten and every new column has a
-- default, so the migration is safe on a populated database.

-- CreateEnum
CREATE TYPE "FolioLineSource" AS ENUM ('MANUAL', 'MINIBAR', 'FRONT_DESK', 'PARKING', 'SERVICE', 'INTEGRATION');

-- CreateEnum
CREATE TYPE "FolioProductCategory" AS ENUM ('MINIBAR', 'FOOD_BEVERAGE', 'PARKING', 'LAUNDRY', 'SERVICE', 'OTHER');

-- CreateTable
CREATE TABLE "FolioProduct" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "sku" VARCHAR(32) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(400),
    "category" "FolioProductCategory" NOT NULL DEFAULT 'OTHER',
    "unit" VARCHAR(16) NOT NULL DEFAULT 'UN',
    "unitAmount" DECIMAL(10,2) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" UUID,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FolioProduct_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "FolioLine"
    ADD COLUMN "productId" UUID,
    ADD COLUMN "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    ADD COLUMN "unitAmount" DECIMAL(10,2),
    ADD COLUMN "unit" VARCHAR(16),
    ADD COLUMN "source" "FolioLineSource" NOT NULL DEFAULT 'MANUAL';

-- CreateIndex
CREATE UNIQUE INDEX "FolioProduct_propertyId_sku_key" ON "FolioProduct"("propertyId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "FolioProduct_organizationId_propertyId_id_key" ON "FolioProduct"("organizationId", "propertyId", "id");

-- CreateIndex
CREATE INDEX "FolioProduct_organizationId_propertyId_isActive_idx" ON "FolioProduct"("organizationId", "propertyId", "isActive");

-- CreateIndex
CREATE INDEX "FolioProduct_organizationId_propertyId_category_idx" ON "FolioProduct"("organizationId", "propertyId", "category");

-- AddForeignKey
ALTER TABLE "FolioProduct" ADD CONSTRAINT "FolioProduct_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioProduct" ADD CONSTRAINT "FolioProduct_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioProduct" ADD CONSTRAINT "FolioProduct_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioProduct" ADD CONSTRAINT "FolioProduct_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioLine" ADD CONSTRAINT "FolioLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "FolioProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
