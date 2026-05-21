-- CreateTable
CREATE TABLE "HealthService" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "duration" TEXT,
    "price" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthBooking" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "serviceId" TEXT,
    "visitorId" TEXT NOT NULL,
    "preferredTime" TIMESTAMP(3),
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "meetingLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthService_pageId_idx" ON "HealthService"("pageId");

-- CreateIndex
CREATE INDEX "HealthBooking_pageId_idx" ON "HealthBooking"("pageId");

-- CreateIndex
CREATE INDEX "HealthBooking_visitorId_idx" ON "HealthBooking"("visitorId");

-- AddForeignKey
ALTER TABLE "HealthService" ADD CONSTRAINT "HealthService_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthBooking" ADD CONSTRAINT "HealthBooking_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthBooking" ADD CONSTRAINT "HealthBooking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "HealthService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthBooking" ADD CONSTRAINT "HealthBooking_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: add about column to HealthBusiness
ALTER TABLE "HealthBusiness" ADD COLUMN IF NOT EXISTS "about" TEXT;
