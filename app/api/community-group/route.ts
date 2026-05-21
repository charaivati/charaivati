import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

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

    await db.communityBoardMember.create({
      data: { groupId: group.id, userId: payload.userId, role: "Admin" },
    });

    return NextResponse.json({ ok: true, group }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
