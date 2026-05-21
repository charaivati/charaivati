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

export async function PATCH(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isAdmin(groupId, payload.userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { name, logoUrl, objective } = await req.json();
    const group = await db.communityGroup.update({
      where: { id: groupId },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(logoUrl !== undefined ? { logoUrl } : {}),
        ...(objective !== undefined ? { objective: objective.trim() || null } : {}),
      },
    });
    return NextResponse.json({ ok: true, group });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
