import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

// DELETE /api/community-group/[groupId]/posts/[postId]
// Allowed for: post owner, group admin (page owner or board member)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ groupId: string; postId: string }> }
) {
  const { groupId, postId } = await params;
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [post, group] = await Promise.all([
      db.post.findUnique({ where: { id: postId }, select: { userId: true, status: true } }),
      db.communityGroup.findUnique({
        where: { id: groupId },
        select: { page: { select: { ownerId: true } }, boardMembers: { select: { userId: true } } },
      }),
    ]);

    if (!post || post.status === "deleted") return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (!group) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const isOwner = post.userId === payload.userId;
    const isAdmin = group.page.ownerId === payload.userId || group.boardMembers.some((b) => b.userId === payload.userId);
    if (!isOwner && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await db.post.update({ where: { id: postId }, data: { status: "deleted" } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
