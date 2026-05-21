import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const memberGroupId: string | undefined = body.memberGroupId;

    const group = await db.communityGroup.findUnique({ where: { id: groupId } });
    if (!group) return NextResponse.json({ error: "group_not_found" }, { status: 404 });

    if (memberGroupId) {
      const memberGroup = await db.communityGroup.findUnique({
        where: { id: memberGroupId },
        include: { page: { select: { ownerId: true } } },
      });
      if (!memberGroup) return NextResponse.json({ error: "member_group_not_found" }, { status: 404 });
      if (memberGroup.page.ownerId !== payload.userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const existing = await db.communityMembership.findFirst({ where: { groupId, memberGroupId } });
      if (existing) return NextResponse.json({ ok: true, membership: existing });

      const membership = await db.communityMembership.create({
        data: { groupId, memberGroupId, status: "pending" },
      });
      return NextResponse.json({ ok: true, membership }, { status: 201 });
    } else {
      const existing = await db.communityMembership.findFirst({ where: { groupId, memberUserId: payload.userId } });
      if (existing) return NextResponse.json({ ok: true, membership: existing });

      const membership = await db.communityMembership.create({
        data: { groupId, memberUserId: payload.userId, status: "pending" },
      });
      return NextResponse.json({ ok: true, membership }, { status: 201 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
