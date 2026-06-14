-- TAG-STORE-1b: store discovery taxonomy — flat controlled vocabulary,
-- separate axis from Page.pageType (initiative type). No parentId hierarchy.

CREATE TABLE IF NOT EXISTS "StoreCategory" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StoreCategory_slug_key" ON "StoreCategory"("slug");

CREATE TABLE IF NOT EXISTS "StoreCategoryTranslation" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  CONSTRAINT "StoreCategoryTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StoreCategoryTranslation_categoryId_locale_key" ON "StoreCategoryTranslation"("categoryId", "locale");
CREATE INDEX IF NOT EXISTS "StoreCategoryTranslation_locale_idx" ON "StoreCategoryTranslation"("locale");

ALTER TABLE "StoreCategoryTranslation" ADD CONSTRAINT "StoreCategoryTranslation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StoreCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "StoreCategoryLink" (
  "storeId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  CONSTRAINT "StoreCategoryLink_pkey" PRIMARY KEY ("storeId", "categoryId")
);

CREATE INDEX IF NOT EXISTS "StoreCategoryLink_categoryId_idx" ON "StoreCategoryLink"("categoryId");

ALTER TABLE "StoreCategoryLink" ADD CONSTRAINT "StoreCategoryLink_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreCategoryLink" ADD CONSTRAINT "StoreCategoryLink_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StoreCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "StoreTag" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StoreTag_slug_key" ON "StoreTag"("slug");

CREATE TABLE IF NOT EXISTS "StoreTagTranslation" (
  "id" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  CONSTRAINT "StoreTagTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StoreTagTranslation_tagId_locale_key" ON "StoreTagTranslation"("tagId", "locale");
CREATE INDEX IF NOT EXISTS "StoreTagTranslation_locale_idx" ON "StoreTagTranslation"("locale");

ALTER TABLE "StoreTagTranslation" ADD CONSTRAINT "StoreTagTranslation_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "StoreTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "StoreTagLink" (
  "storeId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  CONSTRAINT "StoreTagLink_pkey" PRIMARY KEY ("storeId", "tagId")
);

CREATE INDEX IF NOT EXISTS "StoreTagLink_tagId_idx" ON "StoreTagLink"("tagId");

ALTER TABLE "StoreTagLink" ADD CONSTRAINT "StoreTagLink_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreTagLink" ADD CONSTRAINT "StoreTagLink_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "StoreTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
