import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() ?? "";

  const groups = await db.communityGroup.findMany({
    where: { page: { deletedAt: null } },
    select: {
      id: true,
      pageId: true,
      name: true,
      logoUrl: true,
      objective: true,
      _count: { select: { memberships: { where: { status: "approved" } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const filtered = q
    ? groups.filter((g) => g.name.toLowerCase().includes(q) || g.objective?.toLowerCase().includes(q))
    : groups;

  return NextResponse.json({
    groups: filtered.map((g) => ({
      id: g.id,
      pageId: g.pageId,
      name: g.name,
      logoUrl: g.logoUrl,
      objective: g.objective,
      memberCount: g._count.memberships,
    })),
  });
}

export async function POST(req: Request) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { pageId } = await req.json();
    if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });

    const page = await db.page.findUnique({ where: { id: pageId }, select: { ownerId: true, title: true } });
    if (!page) return NextResponse.json({ error: "page_not_found" }, { status: 404 });
    if (page.ownerId !== payload.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const group = await db.communityGroup.create({
      data: { pageId, name: page.title },
    });

    return NextResponse.json({ ok: true, group }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
