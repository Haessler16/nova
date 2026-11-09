-- Phase 6 — pilot feedback. Feedback is property-scoped, append-only by the
-- API (no update of the original message) and reviewed explicitly.

CREATE TYPE "PilotFeedbackCategory" AS ENUM ('BUG', 'UX', 'QUESTION', 'OTHER');
CREATE TYPE "PilotFeedbackStatus" AS ENUM ('OPEN', 'REVIEWED', 'ARCHIVED');

CREATE TABLE "PilotFeedback" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "category" "PilotFeedbackCategory" NOT NULL DEFAULT 'OTHER',
    "message" TEXT NOT NULL,
    "rating" INTEGER,
    "context" JSONB,
    "status" "PilotFeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PilotFeedback_organizationId_propertyId_id_key"
    ON "PilotFeedback"("organizationId", "propertyId", "id");
CREATE INDEX "PilotFeedback_organizationId_propertyId_status_idx"
    ON "PilotFeedback"("organizationId", "propertyId", "status");
CREATE INDEX "PilotFeedback_organizationId_propertyId_createdAt_idx"
    ON "PilotFeedback"("organizationId", "propertyId", "createdAt");

ALTER TABLE "PilotFeedback"
    ADD CONSTRAINT "PilotFeedback_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PilotFeedback"
    ADD CONSTRAINT "PilotFeedback_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PilotFeedback"
    ADD CONSTRAINT "PilotFeedback_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PilotFeedback"
    ADD CONSTRAINT "PilotFeedback_reviewedByUserId_fkey"
    FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Composite tenant constraints: a feedback row cannot reference a property,
-- author or reviewer outside its organization/property scope.
ALTER TABLE "PilotFeedback"
    ADD CONSTRAINT "PilotFeedback_property_tenant_fkey"
    FOREIGN KEY ("organizationId", "propertyId")
    REFERENCES "Property"("organizationId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PilotFeedback"
    ADD CONSTRAINT "PilotFeedback_author_membership_fkey"
    FOREIGN KEY ("organizationId", "userId")
    REFERENCES "Membership"("organizationId", "userId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PilotFeedback"
    ADD CONSTRAINT "PilotFeedback_reviewer_membership_fkey"
    FOREIGN KEY ("organizationId", "reviewedByUserId")
    REFERENCES "Membership"("organizationId", "userId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PilotFeedback"
    ADD CONSTRAINT "PilotFeedback_message_check"
    CHECK (char_length("message") BETWEEN 8 AND 4000);

ALTER TABLE "PilotFeedback"
    ADD CONSTRAINT "PilotFeedback_rating_check"
    CHECK ("rating" IS NULL OR ("rating" BETWEEN 1 AND 5));

ALTER TABLE "PilotFeedback"
    ADD CONSTRAINT "PilotFeedback_context_check"
    CHECK ("context" IS NULL OR jsonb_typeof("context") = 'object');

ALTER TABLE "PilotFeedback"
    ADD CONSTRAINT "PilotFeedback_review_check"
    CHECK (
        ("status" = 'REVIEWED' AND "reviewedAt" IS NOT NULL AND "reviewedByUserId" IS NOT NULL)
        OR ("status" <> 'REVIEWED')
    );
