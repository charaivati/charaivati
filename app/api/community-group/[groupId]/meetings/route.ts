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
    const { title, date, location, link } = await req.json();
    if (!title?.trim() || !date) return NextResponse.json({ error: "title and date required" }, { status: 400 });

    const meeting = await db.communityMeeting.create({
      data: {
        groupId,
        title: title.trim(),
        date: new Date(date),
        location: location?.trim() || null,
        link: link?.trim() || null,
      },
    });
    return NextResponse.json({ ok: true, meeting }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
