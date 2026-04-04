// app/api/chat/conversations/route.ts — list or create DM conversations
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

function canonicalPair(a: string, b: string) {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

/**
 * GET /api/chat/conversations
 * Lists all conversations for the current user, ordered by most recent message.
 */
export async function GET(req: NextRequest) {
  try {
    const me = await getCurrentUser(req);
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const convs = await db.chatConversation.findMany({
      where: { OR: [{ userAId: me.id }, { userBId: me.id }] },
      include: {
        userA: { select: { id: true, name: true, email: true, avatarUrl: true, profile: { select: { displayName: true } } } },
        userB: { select: { id: true, name: true, email: true, avatarUrl: true, profile: { select: { displayName: true } } } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { ciphertext: true, iv: true, senderId: true, createdAt: true },
        },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    const result = convs.map((c) => {
      const other = c.userAId === me.id ? c.userB : c.userA;
      return {
        id: c.id,
        friend: {
          id: other.id,
          name: (other as any).profile?.displayName ?? other.name ?? other.email ?? "User",
          avatarUrl: other.avatarUrl,
        },
        lastMessage: c.messages[0] ?? null,
        lastMessageAt: c.lastMessageAt,
      };
    });

    return NextResponse.json({ ok: true, conversations: result });
  } catch (err: any) {
    console.error("GET /api/chat/conversations error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

/**
 * POST /api/chat/conversations
 * Body: { friendId: string }
 * Gets or creates a conversation with the given friend.
 */
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUser(req);
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const friendId = String(body?.friendId ?? "").trim();
    if (!friendId || friendId === me.id) {
      return NextResponse.json({ ok: false, error: "Invalid friendId" }, { status: 400 });
    }

    // Verify they are actually friends
    const friendship = await db.friendship.findFirst({
      where: {
        OR: [
          { userAId: me.id, userBId: friendId },
          { userAId: friendId, userBId: me.id },
        ],
      },
    });
    if (!friendship) {
      return NextResponse.json({ ok: false, error: "Not friends" }, { status: 403 });
    }

    const pair = canonicalPair(me.id, friendId);

    const conv = await db.chatConversation.upsert({
      where: { userAId_userBId: pair },
      create: pair,
      update: {},
      select: { id: true },
    });

    return NextResponse.json({ ok: true, conversationId: conv.id });
  } catch (err: any) {
    console.error("POST /api/chat/conversations error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
