import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import { scanInput } from "@/lib/ai/guardRail";
import { scopeForUnitType } from "@/lib/civic/constants";

const TITLE_MAX = 140;
const BODY_MAX = 2000;

// GET /api/civic/issues?unitId=X&tab=open|done|archived
// Ranked issue list for a unit's board. "open" includes both proposed and
// active — proposed issues must be visible to gather their first supporters.
export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const unitId = req.nextUrl.searchParams.get("unitId");
  if (!unitId) return NextResponse.json({ error: "unitId required" }, { status: 400 });

  const tab = req.nextUrl.searchParams.get("tab") ?? "open";
  const statuses =
    tab === "done" ? ["complete"] : tab === "archived" ? ["archived"] : ["proposed", "active"];

  const issues = await prisma.issue.findMany({
    where: { unitId, status: { in: statuses } },
    orderBy: [{ supporterCount: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      author: { select: { name: true } },
      supports: { where: { userId: user.id }, select: { id: true } },
    },
  });

  return NextResponse.json({
    issues: issues.map((i) => ({
      id: i.id,
      title: i.title,
      body: i.body,
      status: i.status,
      scope: i.scope,
      supporterCount: i.supporterCount,
      supportedByMe: i.supports.length > 0,
      authorName: i.author?.name ?? "A resident",
      createdAt: i.createdAt,
      resolvedAt: i.resolvedAt,
    })),
  });
}

// POST /api/civic/issues — raise a requirement in the caller's home unit.
// Restricted to residents (homeUnitId must match) so boards can't be brigaded.
// The author auto-supports their own issue (count starts at 1).
export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { unitId, title, body } = await req.json().catch(() => ({}));
  const cleanTitle = typeof title === "string" ? title.trim() : "";
  const cleanBody = typeof body === "string" ? body.trim() : "";

  if (!unitId || !cleanTitle) {
    return NextResponse.json({ error: "unitId and title required" }, { status: 400 });
  }
  if (cleanTitle.length > TITLE_MAX || cleanBody.length > BODY_MAX) {
    return NextResponse.json({ error: "Title or description too long" }, { status: 400 });
  }
  if (
    scanInput(cleanTitle).level === "BLOCK" ||
    (cleanBody && scanInput(cleanBody).level === "BLOCK")
  ) {
    return NextResponse.json({ error: "That content can't be posted." }, { status: 400 });
  }

  const rl = await checkRateLimit(`civic-issue:${user.id}`, 5, 24 * 3600);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "You've raised several issues recently — try again tomorrow." },
      { status: 429 }
    );
  }

  const [me, unit] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { homeUnitId: true } }),
    prisma.unit.findUnique({ where: { id: unitId } }),
  ]);
  if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  if (me?.homeUnitId !== unitId) {
    return NextResponse.json(
      { error: "Only residents of this unit can raise issues here." },
      { status: 403 }
    );
  }

  const issue = await prisma.issue.create({
    data: {
      unitId,
      authorId: user.id,
      title: cleanTitle,
      body: cleanBody,
      scope: scopeForUnitType(unit.type),
      supporterCount: 1,
      supports: { create: { userId: user.id } },
    },
  });

  return NextResponse.json({ ok: true, issue: { id: issue.id } });
}
