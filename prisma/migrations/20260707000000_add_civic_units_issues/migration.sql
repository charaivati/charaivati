-- CIVIC-1: civic layer — Units (geographic membership), Issues (local demands),
-- IssueSupport (one upvote per resident), IssueConfirmation (completion proof,
-- flow lands in a later prompt but the table ships with the rest).
-- Unit.type / Issue.scope / Issue.status are validated in the API, not the DB
-- (Todo.freq/assumptionKey precedent).
-- Apply via `npx prisma db execute --file <this file>` + `npx prisma migrate
-- resolve --applied 20260707000000_add_civic_units_issues` if `migrate dev`
-- hits P3006 (shadow-DB baseline, same as 20260621000000_add_store_category_tag).

CREATE TABLE IF NOT EXISTS "Unit" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "parentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Unit_parentId_idx" ON "Unit"("parentId");
CREATE INDEX IF NOT EXISTS "Unit_type_idx" ON "Unit"("type");

ALTER TABLE "Unit" ADD CONSTRAINT "Unit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Issue" (
  "id" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'ward',
  "status" TEXT NOT NULL DEFAULT 'proposed',
  "category" TEXT,
  "supporterCount" INTEGER NOT NULL DEFAULT 0,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Issue_unitId_status_idx" ON "Issue"("unitId", "status");
CREATE INDEX IF NOT EXISTS "Issue_unitId_supporterCount_idx" ON "Issue"("unitId", "supporterCount");

ALTER TABLE "Issue" ADD CONSTRAINT "Issue_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "IssueSupport" (
  "id" TEXT NOT NULL,
  "issueId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IssueSupport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IssueSupport_userId_issueId_key" ON "IssueSupport"("userId", "issueId");
CREATE INDEX IF NOT EXISTS "IssueSupport_issueId_idx" ON "IssueSupport"("issueId");

ALTER TABLE "IssueSupport" ADD CONSTRAINT "IssueSupport_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IssueSupport" ADD CONSTRAINT "IssueSupport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "IssueConfirmation" (
  "id" TEXT NOT NULL,
  "issueId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "photoUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IssueConfirmation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IssueConfirmation_userId_issueId_key" ON "IssueConfirmation"("userId", "issueId");
CREATE INDEX IF NOT EXISTS "IssueConfirmation_issueId_idx" ON "IssueConfirmation"("issueId");

ALTER TABLE "IssueConfirmation" ADD CONSTRAINT "IssueConfirmation_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IssueConfirmation" ADD CONSTRAINT "IssueConfirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "homeUnitId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "homeUnitChangedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_homeUnitId_idx" ON "User"("homeUnitId");

ALTER TABLE "User" ADD CONSTRAINT "User_homeUnitId_fkey" FOREIGN KEY ("homeUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
