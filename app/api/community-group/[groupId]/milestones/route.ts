import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

async function isAdmin(groupId: string, userId: string): Promise<boolean> {
  const group = await db.communityGroup.findUnique({
    where: { id: groupId },
    include: { page: { select: { ownerId: true } }, boardMembers: { select: { userId: true } } },
  });
  if (!group) return false;
  return group.page.ownerId === userId || group.boardMembers.some((b) => b.userId === userId);
}

export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isAdmin(groupId, payload.userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { title } = await req.json();
    if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });

    const milestone = await db.communityMilestone.create({ data: { groupId, title: title.trim() } });
    return NextResponse.json({ ok: true, milestone }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
