-- Add contact-verification, admin-create, and force-change-password fields to User
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "contactVerified"    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "createdByAdminId"   TEXT;

-- Invite table — one row per email friend-invite
CREATE TABLE IF NOT EXISTS "Invite" (
  "id"            TEXT        NOT NULL,
  "tokenHash"     TEXT        NOT NULL,
  "email"         TEXT        NOT NULL,
  "inviterId"     TEXT        NOT NULL,
  "shellUserId"   TEXT,
  "claimedUserId" TEXT,
  "status"        TEXT        NOT NULL DEFAULT 'pending',
  "attempts"      INTEGER     NOT NULL DEFAULT 0,
  "expiresAt"     TIMESTAMP(3) NOT NULL,
  "claimedAt"     TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Invite_pkey"             PRIMARY KEY ("id"),
  CONSTRAINT "Invite_tokenHash_key"    UNIQUE ("tokenHash"),
  CONSTRAINT "Invite_claimedUserId_key" UNIQUE ("claimedUserId"),
  CONSTRAINT "Invite_inviterId_fkey"   FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Invite_email_status_idx"  ON "Invite"("email", "status");
CREATE INDEX IF NOT EXISTS "Invite_inviterId_idx"     ON "Invite"("inviterId");
