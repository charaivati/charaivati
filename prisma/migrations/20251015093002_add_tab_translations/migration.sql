-- AlterTable
ALTER TABLE "Tab" ADD COLUMN     "gridCol" INTEGER,
ADD COLUMN     "gridRow" INTEGER,
ADD COLUMN     "position" INTEGER;

-- CreateTable
CREATE TABLE "TabTranslation" (
    "id" TEXT NOT NULL,
    "tabId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT,
    "autoTranslated" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'needs_review',
    "suggestedBy" TEXT,
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TabTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TabTranslation_locale_idx" ON "TabTranslation"("locale");

-- CreateIndex
CREATE INDEX "TabTranslation_slug_idx" ON "TabTranslation"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TabTranslation_tabId_locale_key" ON "TabTranslation"("tabId", "locale");

-- AddForeignKey
ALTER TABLE "TabTranslation" ADD CONSTRAINT "TabTranslation_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "Tab"("id") ON DELETE CASCADE ON UPDATE CASCADE;
