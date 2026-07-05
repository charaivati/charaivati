-- SURVIVAL-1: community food plan — owner/board plans food for the whole group.
-- JSONB, read/written via raw SQL (same stale-client pattern as
-- "emergencyContacts"/"bannerUrl" on this table). Apply via the P3006-safe path:
--   npx prisma db execute --file prisma/migrations/20260705000000_add_community_food_plan/migration.sql
--   npx prisma migrate resolve --applied 20260705000000_add_community_food_plan
ALTER TABLE "CommunityGroup" ADD COLUMN IF NOT EXISTS "foodPlan" JSONB;
