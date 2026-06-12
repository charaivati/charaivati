-- Listener (Saathi) slow-built personality layer — one per user (UCTX-3).
-- Hypothesis-grade tone-steering signal only; local-tier composer use only.
CREATE TABLE IF NOT EXISTS "PersonalityProfile" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "disc"        JSONB NOT NULL DEFAULT '{}',
  "driveScores" JSONB NOT NULL DEFAULT '{}',
  "sampleCount" INTEGER NOT NULL DEFAULT 0,
  "confidence"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes"       JSONB NOT NULL DEFAULT '[]',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PersonalityProfile_pkey"       PRIMARY KEY ("id"),
  CONSTRAINT "PersonalityProfile_userId_key" UNIQUE ("userId"),
  CONSTRAINT "PersonalityProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
