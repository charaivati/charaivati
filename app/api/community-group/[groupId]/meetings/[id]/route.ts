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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ groupId: string; id: string }> }
) {
  const { groupId, id } = await params;
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isAdmin(groupId, payload.userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await db.communityMeeting.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
