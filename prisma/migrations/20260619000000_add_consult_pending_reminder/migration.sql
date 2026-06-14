-- ACTION-INTENT-5b: one-turn continuation state for "remind X" with no message yet.
-- Shape: { recipientName: string, awaitingText: true }. Cleared after the very next turn.
ALTER TABLE "ConsultSession" ADD COLUMN IF NOT EXISTS "pendingReminder" JSONB;
