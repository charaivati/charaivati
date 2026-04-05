// app/api/messages/stream/route.ts — SSE endpoint for real-time chat delivery.
//
// Usage: GET /api/messages/stream?conversationId=<id>
//
// The client opens an EventSource here when a conversation is active.
// When a new message is stored via POST /api/chat/conversations/[id]/messages,
// that route emits on the messageEmitter with event `msg:<conversationId>`.
// This handler picks it up and pushes it to all listening clients as an SSE event.
//
// NOTE: In-process EventEmitter — works on a single server instance only.
// See lib/message-emitter.ts for the multi-instance caveat.

import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { messageEmitter } from "@/lib/message-emitter";

export const dynamic = "force-dynamic"; // never cache this route

export async function GET(req: NextRequest) {
  const me = await getCurrentUser(req);
  if (!me) {
    return new Response("Unauthorized", { status: 401 });
  }

  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (!conversationId) {
    return new Response("conversationId required", { status: 400 });
  }

  // Verify the user belongs to this conversation.
  const conv = await db.chatConversation.findUnique({ where: { id: conversationId } });
  if (!conv) {
    return new Response("Not found", { status: 404 });
  }
  if (conv.userAId !== me.id && conv.userBId !== me.id) {
    return new Response("Forbidden", { status: 403 });
  }

  const eventKey = `msg:${conversationId}`;

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      function send(data: string) {
        try {
          controller.enqueue(enc.encode(`data: ${data}\n\n`));
        } catch {
          // Client already disconnected.
        }
      }

      // Push each new message to the SSE stream.
      // Payload shape: { id, senderId, ciphertext, iv, createdAt } — same as polling.
      const onMessage = (payload: unknown) => {
        send(JSON.stringify(payload));
      };

      messageEmitter.on(eventKey, onMessage);

      // Heartbeat every 25 s keeps proxies / load balancers from closing idle connections.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      // Clean up when the client disconnects.
      req.signal.addEventListener("abort", () => {
        messageEmitter.off(eventKey, onMessage);
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      // Allow the browser to reconnect automatically on drop.
      "X-Accel-Buffering": "no",
    },
  });
}
