import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

// DELETE /api/community-group/[groupId]/posts/[postId]/comments/[commentId]
// Allowed for: comment owner or group admin
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ groupId: string; commentId: string }> }
) {
  const { groupId, commentId } = await params;
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [commentRows, group] = await Promise.all([
      db.$queryRaw<{ userId: string }[]>`SELECT "userId" FROM "PostComment" WHERE id = ${commentId} AND status = 'active' LIMIT 1`,
      db.communityGroup.findUnique({
        where: { id: groupId },
        select: { page: { select: { ownerId: true } }, boardMembers: { select: { userId: true } } },
      }),
    ]);

    if (!commentRows[0]) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (!group) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const isOwner = commentRows[0].userId === payload.userId;
    const isAdmin = group.page.ownerId === payload.userId || group.boardMembers.some((b) => b.userId === payload.userId);
    if (!isOwner && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await db.$executeRaw`UPDATE "PostComment" SET status = 'deleted' WHERE id = ${commentId}`;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
