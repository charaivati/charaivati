-- Initiative Ownership Transfer — OTP-gated, email-token accepted, 7-day revoke window.

CREATE TABLE IF NOT EXISTS "InitiativeTransfer" (
  "id"              TEXT NOT NULL,
  "pageId"          TEXT NOT NULL,
  "fromUserId"      TEXT NOT NULL,
  "toEmail"         TEXT NOT NULL,
  "toUserId"        TEXT,
  "status"          TEXT NOT NULL DEFAULT 'otp_pending',
  "otpHash"         TEXT,
  "otpSalt"         TEXT,
  "otpExpiresAt"    TIMESTAMP(3),
  "otpAttempts"     INTEGER NOT NULL DEFAULT 0,
  "recipientToken"  TEXT,
  "recipientExpiry" TIMESTAMP(3),
  "completedAt"     TIMESTAMP(3),
  "revokeDeadline"  TIMESTAMP(3),
  "revokedAt"       TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InitiativeTransfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InitiativeTransfer_recipientToken_key"
  ON "InitiativeTransfer"("recipientToken");

CREATE INDEX IF NOT EXISTS "InitiativeTransfer_pageId_idx"
  ON "InitiativeTransfer"("pageId");

CREATE INDEX IF NOT EXISTS "InitiativeTransfer_fromUserId_idx"
  ON "InitiativeTransfer"("fromUserId");

DO $$ BEGIN
  ALTER TABLE "InitiativeTransfer"
    ADD CONSTRAINT "InitiativeTransfer_pageId_fkey"
    FOREIGN KEY ("pageId") REFERENCES "Page"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
