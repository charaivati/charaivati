-- Stable-prefix history (UCTX-1b) — fold oldest messages into a rolling summary.
ALTER TABLE "ConsultSession" ADD COLUMN IF NOT EXISTS "rollingSummary" TEXT;
ALTER TABLE "ConsultSession" ADD COLUMN IF NOT EXISTS "foldedThrough" TIMESTAMP(3);
