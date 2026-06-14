-- FRIEND-NOTIFY-1: track when pending friend requests were last surfaced by the Listener.
ALTER TABLE "ConsultSession" ADD COLUMN IF NOT EXISTS "friendReqSurfacedAt" TIMESTAMP(3);
