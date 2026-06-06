ALTER TABLE "WorkflowStep" ADD COLUMN IF NOT EXISTS "activityType" TEXT NOT NULL DEFAULT 'normal';

-- Backfill: for each initiativeId, set the step with the highest sequence to "delivery"
UPDATE "WorkflowStep" ws
SET "activityType" = 'delivery'
WHERE ws.id IN (
  SELECT DISTINCT ON ("initiativeId") id
  FROM "WorkflowStep"
  ORDER BY "initiativeId", "sequence" DESC
);
