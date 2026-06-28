import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/community-group/[groupId]/posts/[postId]/comments
// Returns all active comments for a post, with replies nested under their parent.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  try {
    const rows = await db.$queryRaw<{
      id: string; postId: string; userId: string; parentId: string | null;
      content: string; createdAt: Date;
      userName: string | null; userAvatar: string | null;
    }[]>`
      SELECT c.id, c."postId", c."userId", c."parentId", c.content, c."createdAt",
             u.name AS "userName", u."avatarUrl" AS "userAvatar"
      FROM "PostComment" c
      JOIN "User" u ON u.id = c."userId"
      WHERE c."postId" = ${postId} AND c.status = 'active'
      ORDER BY c."createdAt" ASC
    `;

    // Nest replies under parents client-side
    type Comment = typeof rows[0] & { replies: typeof rows };
    const map = new Map<string, Comment>();
    const roots: Comment[] = [];
    for (const r of rows) map.set(r.id, { ...r, replies: [] });
    for (const r of rows) {
      const node = map.get(r.id)!;
      if (r.parentId && map.has(r.parentId)) map.get(r.parentId)!.replies.push(node);
      else roots.push(node);
    }

    return NextResponse.json({ ok: true, comments: roots });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/community-group/[groupId]/posts/[postId]/comments
export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { content, parentId } = await req.json();
    if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 });

    // Validate parentId belongs to the same post
    if (parentId) {
      const parent = await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM "PostComment" WHERE id = ${parentId} AND "postId" = ${postId} AND status = 'active' LIMIT 1
      `;
      if (!parent[0]) return NextResponse.json({ error: "Parent comment not found" }, { status: 400 });
    }

    const rows = await db.$queryRaw<{ id: string; createdAt: Date }[]>`
      INSERT INTO "PostComment" ("postId", "userId", "parentId", content)
      VALUES (${postId}, ${payload.userId}, ${parentId ?? null}, ${content.trim()})
      RETURNING id, "createdAt"
    `;
    const created = rows[0];

    const userRows = await db.$queryRaw<{ name: string | null; avatarUrl: string | null }[]>`
      SELECT name, "avatarUrl" FROM "User" WHERE id = ${payload.userId} LIMIT 1
    `;

    return NextResponse.json({
      ok: true,
      comment: {
        id: created.id,
        postId,
        userId: payload.userId,
        parentId: parentId ?? null,
        content: content.trim(),
        createdAt: created.createdAt,
        userName: userRows[0]?.name ?? null,
        userAvatar: userRows[0]?.avatarUrl ?? null,
        replies: [],
      },
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
