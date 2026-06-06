// app/api/business/idea/goals/route.ts
// GET  ?ideaId=   — list goals linked to a business idea
// POST { ideaId, goalId } — link a goal to a business idea (session required)
// DELETE { ideaId, goalId } — de-link a goal from a business idea (session required)
//
// NOTE: BusinessIdeaGoal was added via Neon MCP migration. Using $queryRaw/$executeRaw
// until a full `npx prisma generate` (server stopped) adds it to the typed client.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

const GUEST_COOKIE = "biz-guest";

async function resolveOwnership(req: NextRequest, ideaId: string) {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifySessionToken(token) : null;
  const sessionUserId = payload?.userId ?? null;
  const guestSessionId = req.cookies.get(GUEST_COOKIE)?.value ?? null;

  const ideas = await db.$queryRaw<{ id: string; userId: string | null; guestSessionId: string | null }[]>`
    SELECT id, "userId", "guestSessionId" FROM "BusinessIdea" WHERE id = ${ideaId} LIMIT 1
  `;
  const idea = ideas[0] ?? null;
  if (!idea) return { allowed: false, idea: null, sessionUserId: null };

  const owned = idea.userId
    ? idea.userId === sessionUserId
    : !!guestSessionId && idea.guestSessionId === guestSessionId;

  return { allowed: owned, idea, sessionUserId };
}

// GET ?ideaId= — list linked goals (id, title, archetype)
export async function GET(req: NextRequest) {
  const ideaId = new URL(req.url).searchParams.get("ideaId");
  if (!ideaId) return NextResponse.json({ ok: false, error: "ideaId required" }, { status: 400 });

  const { allowed, sessionUserId } = await resolveOwnership(req, ideaId);
  if (!allowed) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  // Guests can't have linked goals
  if (!sessionUserId) return NextResponse.json({ ok: true, goals: [] });

  const goals = await db.$queryRaw<{ id: string; title: string; archetype: string; status: string }[]>`
    SELECT g.id, g.title, g.archetype, g.status
    FROM "BusinessIdeaGoal" big
    JOIN "AiGoal" g ON g.id = big."goalId"
    WHERE big."businessIdeaId" = ${ideaId}
    ORDER BY big."createdAt" ASC
  `;

  return NextResponse.json({ ok: true, goals });
}

// POST { ideaId, goalId } — link
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { ideaId, goalId } = body as { ideaId?: string; goalId?: string };

  if (!ideaId || !goalId) {
    return NextResponse.json({ ok: false, error: "ideaId and goalId required" }, { status: 400 });
  }

  const { allowed, idea, sessionUserId } = await resolveOwnership(req, ideaId);
  if (!allowed || !idea) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!sessionUserId) {
    return NextResponse.json({ ok: false, error: "Sign in to link goals" }, { status: 401 });
  }

  // Verify the goal belongs to this user
  const goals = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "AiGoal" WHERE id = ${goalId} AND "userId" = ${sessionUserId} LIMIT 1
  `;
  if (!goals.length) return NextResponse.json({ ok: false, error: "Goal not found" }, { status: 404 });

  // Upsert — idempotent
  await db.$executeRaw`
    INSERT INTO "BusinessIdeaGoal" ("businessIdeaId", "goalId", "createdAt")
    VALUES (${ideaId}, ${goalId}, NOW())
    ON CONFLICT ("businessIdeaId", "goalId") DO NOTHING
  `;

  return NextResponse.json({ ok: true });
}

// DELETE { ideaId, goalId } — de-link
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { ideaId, goalId } = body as { ideaId?: string; goalId?: string };

  if (!ideaId || !goalId) {
    return NextResponse.json({ ok: false, error: "ideaId and goalId required" }, { status: 400 });
  }

  const { allowed, sessionUserId } = await resolveOwnership(req, ideaId);
  if (!allowed) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!sessionUserId) {
    return NextResponse.json({ ok: false, error: "Sign in to manage goal links" }, { status: 401 });
  }

  await db.$executeRaw`
    DELETE FROM "BusinessIdeaGoal" WHERE "businessIdeaId" = ${ideaId} AND "goalId" = ${goalId}
  `;

  return NextResponse.json({ ok: true });
}
