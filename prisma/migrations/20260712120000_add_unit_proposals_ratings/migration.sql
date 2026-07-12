-- Public-driven civic units + fixed-parameter area ratings:
-- 1. Unit.status/proposedById — community-proposed units start "pending" and
--    verify automatically once enough users claim them as home.
-- 2. UnitRating — one 1–5 score per resident per fixed parameter (water,
--    electricity, …). Areas show averages; rollups average across descendants.

ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'verified';
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "proposedById" TEXT;

ALTER TABLE "Unit" ADD CONSTRAINT "Unit_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "UnitRating" (
  "id" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "parameter" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UnitRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UnitRating_userId_unitId_parameter_key" ON "UnitRating"("userId", "unitId", "parameter");
CREATE INDEX IF NOT EXISTS "UnitRating_unitId_parameter_idx" ON "UnitRating"("unitId", "parameter");

ALTER TABLE "UnitRating" ADD CONSTRAINT "UnitRating_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnitRating" ADD CONSTRAINT "UnitRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
