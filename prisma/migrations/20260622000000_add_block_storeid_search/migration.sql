-- PRODSEARCH-1b Step 1: denormalize storeId onto Block for fast product-level queries
-- The Block table maps to model StoreBlock in Prisma.
ALTER TABLE "Block"
  ADD COLUMN IF NOT EXISTS "storeId" TEXT REFERENCES "Store"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "Block_storeId_idx" ON "Block"("storeId");

-- Backfill from the section → store chain
UPDATE "Block" b
  SET "storeId" = s."storeId"
  FROM "Section" s
  WHERE b."sectionId" = s."id"
    AND b."storeId" IS NULL;

-- PRODSEARCH-1b Step 2: full-text search tsvector column + GIN index on Block
ALTER TABLE "Block"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce("title", '') || ' ' || coalesce("description", '')
      )
    ) STORED;

CREATE INDEX IF NOT EXISTS "Block_search_vector_idx" ON "Block" USING GIN("search_vector");
