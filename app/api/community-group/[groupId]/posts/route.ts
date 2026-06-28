import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { scanInput } from "@/lib/ai/guardRail";
import { chatComplete } from "@/app/api/aiClient";
import { createNotification } from "@/lib/notifications/createNotification";

export const dynamic = "force-dynamic";

// GET /api/community-group/[groupId]/posts — public feed (active posts only)
export async function GET(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  try {
    const group = await db.communityGroup.findUnique({ where: { id: groupId }, select: { pageId: true } });
    if (!group) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const posts = await db.post.findMany({
      where: { pageId: group.pageId, status: "active" },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return NextResponse.json({ ok: true, posts });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/community-group/[groupId]/posts — create a post (any logged-in user)
export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { content } = await req.json();
    if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 });

    // First-pass: regex guardrail (prompt injection, harmful patterns)
    const scan = scanInput(content);
    if (scan.level === "BLOCK") {
      return NextResponse.json({ error: "Post blocked by content filter." }, { status: 400 });
    }

    const group = await db.communityGroup.findUnique({
      where: { id: groupId },
      select: { pageId: true, page: { select: { ownerId: true } }, boardMembers: { select: { userId: true } } },
    });
    if (!group) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const post = await db.post.create({
      data: { userId: payload.userId, pageId: group.pageId, content: content.trim(), visibility: "public" },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    // Async AI moderation — runs after response is sent, never blocks the user
    after(async () => {
      try {
        const reply = await chatComplete([
          {
            role: "user",
            content: `You are a community content moderator. Is the following post spam, hate speech, or inappropriate for a neighbourhood community group? Reply with JSON only: {"flagged": boolean, "reason": string}\n\nPost: "${content.trim().slice(0, 500)}"`,
          },
        ], { maxTokens: 80, jsonMode: true });

        let flagged = false;
        try {
          const parsed = JSON.parse(reply);
          flagged = !!parsed.flagged;
        } catch {
          // Unparseable → fail open (don't flag)
        }

        if (flagged) {
          await db.post.update({ where: { id: post.id }, data: { status: "flagged" } });
          // Notify group admin (page owner)
          await createNotification({
            userId: group.page.ownerId!,
            type: "post_flagged",
            title: "Post flagged for review",
            body: `A post in your community was flagged by AI moderation.`,
            link: `/community/${groupId}`,
          });
        }
      } catch {
        // AI moderation failure is non-fatal — post stays active
      }
    });

    return NextResponse.json({ ok: true, post }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
