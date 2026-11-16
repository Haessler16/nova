-- Additive Phase 2 support: the room list/drawer shows who last modified a
-- room. The column is nullable so existing rows and system reconciliations do
-- not invent an actor. No existing column or constraint is changed.
ALTER TABLE "Room" ADD COLUMN "updatedByUserId" UUID;

ALTER TABLE "Room"
  ADD CONSTRAINT "Room_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Room_updatedByUserId_idx" ON "Room"("updatedByUserId");
