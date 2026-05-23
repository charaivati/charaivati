-- Address: GPS coordinates for delivery distance calculation
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION;
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION;

-- Block (StoreBlock): physical weight for per-kg delivery cost calculation
ALTER TABLE "Block" ADD COLUMN IF NOT EXISTS "weight" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- Collaboration: scope, team roles, and delivery cost structures
ALTER TABLE "Collaboration" ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'partner';
ALTER TABLE "Collaboration" ADD COLUMN IF NOT EXISTS "initiativeId" TEXT;
ALTER TABLE "Collaboration" ADD COLUMN IF NOT EXISTS "teamRole" TEXT;
ALTER TABLE "Collaboration" ADD COLUMN IF NOT EXISTS "customRole" TEXT;
ALTER TABLE "Collaboration" ADD COLUMN IF NOT EXISTS "costPerOrder" DOUBLE PRECISION;
ALTER TABLE "Collaboration" ADD COLUMN IF NOT EXISTS "costPerKg" DOUBLE PRECISION;
ALTER TABLE "Collaboration" ADD COLUMN IF NOT EXISTS "costPerKgPerKm" DOUBLE PRECISION;
ALTER TABLE "Collaboration" ADD COLUMN IF NOT EXISTS "costPerItemPerKm" DOUBLE PRECISION;
