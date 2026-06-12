-- Admin bridge (PERSONA-1): admin-taught philosophy lenses + anonymized
-- knowledge-gap question queue. Neither model has a userId FK —
-- PhilosophyPersona is platform-wide; AdminQuestion is deliberately
-- anonymized (no userId, by design).
CREATE TABLE IF NOT EXISTS "PhilosophyPersona" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "triggers"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status"      TEXT NOT NULL DEFAULT 'draft',
  "sourceType"  TEXT NOT NULL DEFAULT 'admin_taught',
  "attribution" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PhilosophyPersona_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "PhilosophyPersona_name_key"  UNIQUE ("name")
);

CREATE TABLE IF NOT EXISTS "AdminQuestion" (
  "id"         TEXT NOT NULL,
  "source"     TEXT NOT NULL,
  "question"   TEXT NOT NULL,
  "topic"      TEXT,
  "status"     TEXT NOT NULL DEFAULT 'open',
  "answer"     TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "answeredAt" TIMESTAMP(3),

  CONSTRAINT "AdminQuestion_pkey" PRIMARY KEY ("id")
);
