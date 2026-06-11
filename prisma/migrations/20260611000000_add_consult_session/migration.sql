-- Listener (Saathi) consultation sessions — one per user (CONSULT-1b)
CREATE TABLE IF NOT EXISTS "ConsultSession" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "consultStage" INTEGER NOT NULL DEFAULT 0,
  "insights"     JSONB NOT NULL DEFAULT '{}',
  "language"     TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ConsultSession_pkey"       PRIMARY KEY ("id"),
  CONSTRAINT "ConsultSession_userId_key" UNIQUE ("userId"),
  CONSTRAINT "ConsultSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ConsultMessage" (
  "id"        TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "role"      TEXT NOT NULL,
  "content"   TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ConsultMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConsultMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConsultSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ConsultMessage_sessionId_createdAt_idx" ON "ConsultMessage"("sessionId", "createdAt");
