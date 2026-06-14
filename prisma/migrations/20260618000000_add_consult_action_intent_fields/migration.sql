-- ACTION-INTENT-3: per-user conversational bookkeeping on ConsultSession.
-- Never merged into insights; used for login offer pacing, logout/clear-chat
-- flows, and pronoun-resolution context for the intent classifier.
ALTER TABLE "ConsultSession" ADD COLUMN IF NOT EXISTS "greetedThisSession" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ConsultSession" ADD COLUMN IF NOT EXISTS "loginDeclined" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ConsultSession" ADD COLUMN IF NOT EXISTS "loginLastAskedAt" TIMESTAMP(3);
ALTER TABLE "ConsultSession" ADD COLUMN IF NOT EXISTS "chatResetAt" TIMESTAMP(3);
ALTER TABLE "ConsultSession" ADD COLUMN IF NOT EXISTS "recentIntentNote" TEXT;
