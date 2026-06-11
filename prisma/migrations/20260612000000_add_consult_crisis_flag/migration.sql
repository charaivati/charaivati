-- Listener crisis-mode latch (CONSULT-2) — set on crisis detection, never auto-cleared
ALTER TABLE "ConsultSession" ADD COLUMN IF NOT EXISTS "crisisFlag" BOOLEAN NOT NULL DEFAULT FALSE;
