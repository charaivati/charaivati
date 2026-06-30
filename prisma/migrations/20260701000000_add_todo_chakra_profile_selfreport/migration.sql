-- CHAKRA-1: chakra channel columns on Todo + per-chakra self-report on Profile.
-- Values validated in the API (root|sacral|solar|heart|throat|third_eye|crown for
-- chakra; manual|validation|execution_plan|initiative for source), not the DB —
-- matches the freq/assumptionKey string-discriminator precedent. Backfill null.

ALTER TABLE "Todo" ADD COLUMN IF NOT EXISTS "chakra" TEXT;
ALTER TABLE "Todo" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "chakraSelfReport" JSONB;
