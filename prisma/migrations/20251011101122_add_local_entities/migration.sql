-- AlterTable
ALTER TABLE "User" ADD COLUMN     "selectedCountry" TEXT;

-- CreateTable
CREATE TABLE "Country" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminLevel" (
    "id" SERIAL NOT NULL,
    "countryId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "slug" TEXT,

    CONSTRAINT "AdminLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" SERIAL NOT NULL,
    "countryId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "level" INTEGER NOT NULL,
    "population" INTEGER,
    "areaSqKm" DOUBLE PRECISION,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalArea" (
    "id" SERIAL NOT NULL,
    "regionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "population" INTEGER,
    "areaWorth" DOUBLE PRECISION,

    CONSTRAINT "LocalArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" SERIAL NOT NULL,
    "localAreaId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "units" TEXT,
    "notes" TEXT,
    "adminUrl" TEXT,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Representative" (
    "id" SERIAL NOT NULL,
    "regionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "party" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "contact" TEXT,

    CONSTRAINT "Representative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");

-- CreateIndex
CREATE INDEX "AdminLevel_countryId_idx" ON "AdminLevel"("countryId");

-- CreateIndex
CREATE INDEX "Region_countryId_idx" ON "Region"("countryId");

-- CreateIndex
CREATE INDEX "Region_level_idx" ON "Region"("level");

-- CreateIndex
CREATE INDEX "LocalArea_regionId_idx" ON "LocalArea"("regionId");

-- CreateIndex
CREATE INDEX "Asset_localAreaId_idx" ON "Asset"("localAreaId");

-- CreateIndex
CREATE INDEX "Representative_regionId_idx" ON "Representative"("regionId");

-- AddForeignKey
ALTER TABLE "AdminLevel" ADD CONSTRAINT "AdminLevel_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalArea" ADD CONSTRAINT "LocalArea_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_localAreaId_fkey" FOREIGN KEY ("localAreaId") REFERENCES "LocalArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Representative" ADD CONSTRAINT "Representative_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;
