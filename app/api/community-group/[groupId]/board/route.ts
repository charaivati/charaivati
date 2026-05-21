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
    const { userId, role } = await req.json();
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, avatarUrl: true } });
    if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

    const member = await db.communityBoardMember.upsert({
      where: { groupId_userId: { groupId, userId } },
      create: { groupId, userId, role: role ?? null },
      update: { role: role ?? null },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    return NextResponse.json({ ok: true, member }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
