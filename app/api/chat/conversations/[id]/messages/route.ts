// app/api/chat/conversations/[id]/messages/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { messageEmitter } from "@/lib/message-emitter";

/**
 * GET /api/chat/conversations/[id]/messages?after=ISO_TIMESTAMP
 * Returns messages in a conversation, newest-last.
 * Pass ?after= to only fetch messages newer than a given timestamp (for polling).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getCurrentUser(req);
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const conv = await db.chatConversation.findUnique({ where: { id } });
    if (!conv) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    if (conv.userAId !== me.id && conv.userBId !== me.id) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const afterParam = req.nextUrl.searchParams.get("after");
    const after = afterParam ? new Date(afterParam) : undefined;

    const messages = await db.chatMessage.findMany({
      where: {
        conversationId: id,
        ...(after ? { createdAt: { gt: after } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: { id: true, senderId: true, ciphertext: true, iv: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, messages });
  } catch (err: any) {
    console.error("GET /api/chat/conversations/[id]/messages error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

/**
 * POST /api/chat/conversations/[id]/messages
 * Body: { ciphertext: string, iv: string }
 * Stores an encrypted message. Server never sees plaintext.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getCurrentUser(req);
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const conv = await db.chatConversation.findUnique({ where: { id } });
    if (!conv) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    if (conv.userAId !== me.id && conv.userBId !== me.id) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const ciphertext = String(body?.ciphertext ?? "").trim();
    const iv = String(body?.iv ?? "").trim();

    if (!ciphertext || !iv) {
      return NextResponse.json({ ok: false, error: "ciphertext and iv required" }, { status: 400 });
    }

    const now = new Date();
    const [msg] = await db.$transaction([
      db.chatMessage.create({
        data: { conversationId: id, senderId: me.id, ciphertext, iv },
        select: { id: true, senderId: true, ciphertext: true, iv: true, createdAt: true },
      }),
      db.chatConversation.update({
        where: { id },
        data: { lastMessageAt: now },
      }),
    ]);

    // Notify any SSE listeners for this conversation (non-blocking).
    messageEmitter.emit(`msg:${id}`, msg);

    return NextResponse.json({ ok: true, message: msg });
  } catch (err: any) {
    console.error("POST /api/chat/conversations/[id]/messages error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
