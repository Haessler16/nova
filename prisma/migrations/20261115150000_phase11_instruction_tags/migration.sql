-- Phase 11 — pastel/free-form tags promised by the PRD but omitted from the
-- first conceptual model. Additive: existing instructions keep an empty list.

ALTER TABLE "ReservationInstruction"
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "ReservationInstruction_tags_gin_idx"
ON "ReservationInstruction" USING GIN ("tags");
