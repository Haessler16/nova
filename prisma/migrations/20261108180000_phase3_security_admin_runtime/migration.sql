-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaEnrolledAt" TIMESTAMP(3),
ADD COLUMN     "mfaLastUsedStep" INTEGER,
ADD COLUMN     "mfaSecret" TEXT,
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "system" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "ipHash" VARCHAR(64),
ADD COLUMN     "userAgent" VARCHAR(255);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "requestedIpHash" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "requestedIpHash" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "userId" UUID,
    "actorUserId" UUID,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "ipHash" VARCHAR(64),
    "userAgent" VARCHAR(255),
    "correlationId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_expiresAt_idx" ON "EmailVerificationToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_organizationId_occurredAt_idx" ON "SecurityEvent"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_userId_occurredAt_idx" ON "SecurityEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_type_occurredAt_idx" ON "SecurityEvent"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "User_lockedUntil_idx" ON "User"("lockedUntil");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- NOVA PMS — Security administration and runtime hardening (manual SQL)
-- ---------------------------------------------------------------------------

-- One usable reset/verification token per user at a time. Issuing a new token
-- first deletes the previous unused row, so a partial unique index is safe and
-- prevents accidental parallel tokens from widening the attack surface.
CREATE UNIQUE INDEX "PasswordResetToken_active_user_key"
    ON "PasswordResetToken"("userId")
    WHERE "usedAt" IS NULL;

CREATE UNIQUE INDEX "EmailVerificationToken_active_user_key"
    ON "EmailVerificationToken"("userId")
    WHERE "usedAt" IS NULL;

ALTER TABLE "PasswordResetToken"
    ADD CONSTRAINT "PasswordResetToken_hash_check"
    CHECK ("tokenHash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "PasswordResetToken"
    ADD CONSTRAINT "PasswordResetToken_expiry_check"
    CHECK ("expiresAt" > "createdAt");

ALTER TABLE "EmailVerificationToken"
    ADD CONSTRAINT "EmailVerificationToken_hash_check"
    CHECK ("tokenHash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "EmailVerificationToken"
    ADD CONSTRAINT "EmailVerificationToken_expiry_check"
    CHECK ("expiresAt" > "createdAt");

ALTER TABLE "User"
    ADD CONSTRAINT "User_lockout_fields_check"
    CHECK ("failedLoginAttempts" >= 0);

ALTER TABLE "User"
    ADD CONSTRAINT "User_mfa_fields_check"
    CHECK (
        ("mfaEnabled" = false OR ("mfaSecret" IS NOT NULL AND "mfaEnrolledAt" IS NOT NULL))
        AND ("mfaEnrolledAt" IS NULL OR "mfaSecret" IS NOT NULL)
        AND ("mfaLastUsedStep" IS NULL OR "mfaLastUsedStep" >= 0)
    );

ALTER TABLE "Session"
    ADD CONSTRAINT "Session_ip_hash_check"
    CHECK ("ipHash" IS NULL OR "ipHash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "Session"
    ADD CONSTRAINT "Session_user_agent_check"
    CHECK ("userAgent" IS NULL OR length("userAgent") BETWEEN 1 AND 255);

ALTER TABLE "Role"
    ADD CONSTRAINT "Role_key_check"
    CHECK ("key" = upper("key") AND "key" ~ '^[A-Z0-9_.-]{2,64}$');

ALTER TABLE "Role"
    ADD CONSTRAINT "Role_name_check"
    CHECK ("name" = btrim("name") AND length("name") BETWEEN 1 AND 120);

ALTER TABLE "SecurityEvent"
    ADD CONSTRAINT "SecurityEvent_type_check"
    CHECK ("type" ~ '^[a-z][a-z0-9_.-]{2,64}$');

ALTER TABLE "SecurityEvent"
    ADD CONSTRAINT "SecurityEvent_severity_check"
    CHECK ("severity" IN ('INFO', 'WARNING', 'CRITICAL'));

ALTER TABLE "SecurityEvent"
    ADD CONSTRAINT "SecurityEvent_metadata_size_check"
    CHECK ("metadata" IS NULL OR pg_column_size("metadata") <= 8192);

-- Append-only security trail: rejects UPDATE, DELETE and TRUNCATE.
CREATE OR REPLACE FUNCTION "nova_security_event_append_only"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'SecurityEvent is append-only (operation %)', TG_OP
        USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER "SecurityEvent_append_only_row"
    BEFORE UPDATE OR DELETE ON "SecurityEvent"
    FOR EACH ROW EXECUTE FUNCTION "nova_security_event_append_only"();

CREATE TRIGGER "SecurityEvent_append_only_truncate"
    BEFORE TRUNCATE ON "SecurityEvent"
    FOR EACH STATEMENT EXECUTE FUNCTION "nova_security_event_append_only"();
