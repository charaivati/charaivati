-- REQBCAST-1c: RequestBroadcast engine (inDrive/noticeboard).
-- Noticeboard, NOT dispatcher — platform never assigns, prices, or escrows.
-- Broadcast lifecycle status and per-response status are SEPARATE fields
-- (avoids the OSP "one literal means different things to different readers" footgun).
-- kind="errand" fields present but dormant (errand logic is a later prompt).

CREATE TABLE IF NOT EXISTS "RequestBroadcast" (
  "id" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'service',
  "categoryId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "addressLat" DOUBLE PRECISION,
  "addressLng" DOUBLE PRECISION,
  "radiusKm" DOUBLE PRECISION NOT NULL DEFAULT 5,
  "acceptedResponseId" TEXT,
  "pickupLat" DOUBLE PRECISION,
  "pickupLng" DOUBLE PRECISION,
  "dropLat" DOUBLE PRECISION,
  "dropLng" DOUBLE PRECISION,
  "suggestedPrice" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  CONSTRAINT "RequestBroadcast_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RequestBroadcast_status_idx" ON "RequestBroadcast"("status");
CREATE INDEX IF NOT EXISTS "RequestBroadcast_categoryId_idx" ON "RequestBroadcast"("categoryId");
CREATE INDEX IF NOT EXISTS "RequestBroadcast_createdAt_idx" ON "RequestBroadcast"("createdAt");
CREATE INDEX IF NOT EXISTS "RequestBroadcast_addressLat_addressLng_idx" ON "RequestBroadcast"("addressLat", "addressLng");

ALTER TABLE "RequestBroadcast" ADD CONSTRAINT "RequestBroadcast_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequestBroadcast" ADD CONSTRAINT "RequestBroadcast_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StoreCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "RequestResponse" (
  "id" TEXT NOT NULL,
  "broadcastId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "providerStoreId" TEXT,
  "quotedPrice" DOUBLE PRECISION,
  "message" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequestResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RequestResponse_broadcastId_providerId_key" ON "RequestResponse"("broadcastId", "providerId");
CREATE INDEX IF NOT EXISTS "RequestResponse_broadcastId_idx" ON "RequestResponse"("broadcastId");
CREATE INDEX IF NOT EXISTS "RequestResponse_providerId_idx" ON "RequestResponse"("providerId");

ALTER TABLE "RequestResponse" ADD CONSTRAINT "RequestResponse_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "RequestBroadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequestResponse" ADD CONSTRAINT "RequestResponse_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequestResponse" ADD CONSTRAINT "RequestResponse_providerStoreId_fkey" FOREIGN KEY ("providerStoreId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
