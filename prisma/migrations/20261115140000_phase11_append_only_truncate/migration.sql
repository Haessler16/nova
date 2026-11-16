-- Phase 11 hardening — the original append-only triggers reject UPDATE and
-- DELETE, but PostgreSQL does not fire row triggers on TRUNCATE. Add
-- statement-level TRUNCATE guards so audit-grade source text and instruction
-- events cannot be wiped without dropping the trigger first.

CREATE OR REPLACE FUNCTION "ReservationSourceNote_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ReservationSourceNote is immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ReservationSourceNote_immutable_truncate_trigger" ON "ReservationSourceNote";
CREATE TRIGGER "ReservationSourceNote_immutable_truncate_trigger"
BEFORE TRUNCATE ON "ReservationSourceNote"
FOR EACH STATEMENT EXECUTE FUNCTION "ReservationSourceNote_immutable"();

CREATE OR REPLACE FUNCTION "InstructionEvent_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'InstructionEvent is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "InstructionEvent_append_only_truncate_trigger" ON "InstructionEvent";
CREATE TRIGGER "InstructionEvent_append_only_truncate_trigger"
BEFORE TRUNCATE ON "InstructionEvent"
FOR EACH STATEMENT EXECUTE FUNCTION "InstructionEvent_append_only"();
