-- FLEET-STATE-1b P1: ProviderPresence — live foreground location for fleet/runner
-- providers. Foreground-only, adaptive, distance-gated, match-on-recent.
-- ADDITIVE to eligibility: a provider matches on a FRESH available presence OR
-- their static Store.lat/lng (never "presence required").
-- mode: "offline" | "available" (P1). "on_job" | "near_complete" arrive in P2.
-- Freshness (5 min) is enforced at READ time in eligibility, not by a scheduler.

CREATE TABLE IF NOT EXISTS "ProviderPresence" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "seenAt" TIMESTAMP(3),
  "mode" TEXT NOT NULL DEFAULT 'offline',
  CONSTRAINT "ProviderPresence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderPresence_userId_key" ON "ProviderPresence"("userId");
CREATE INDEX IF NOT EXISTS "ProviderPresence_lat_lng_idx" ON "ProviderPresence"("lat", "lng");
CREATE INDEX IF NOT EXISTS "ProviderPresence_seenAt_idx" ON "ProviderPresence"("seenAt");

-- Postgres has no "ADD CONSTRAINT IF NOT EXISTS" — guard so re-apply is idempotent.
DO $$ BEGIN
  ALTER TABLE "ProviderPresence" ADD CONSTRAINT "ProviderPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
