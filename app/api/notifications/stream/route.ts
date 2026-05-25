import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = user.id;
  const encoder = new TextEncoder();

  let prevUnreadCount = -1;
  let prevLatestId = "";

  async function fetchState() {
    const notifications = await (prisma as any).notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true, type: true, title: true, body: true,
        link: true, read: true, createdAt: true,
      },
    }) as {
      id: string; type: string; title: string; body: string;
      link: string | null; read: boolean; createdAt: Date;
    }[];

    const unreadCount = notifications.filter((n) => !n.read).length;
    const latestId = notifications[0]?.id ?? "";
    return { notifications, unreadCount, latestId };
  }

  const stream = new ReadableStream({
    async start(controller) {
      function send(payload: unknown) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // controller already closed
        }
      }

      async function poll() {
        if (req.signal.aborted) return;
        try {
          const { notifications, unreadCount, latestId } = await fetchState();
          if (unreadCount !== prevUnreadCount || latestId !== prevLatestId) {
            prevUnreadCount = unreadCount;
            prevLatestId = latestId;
            send({ notifications, unreadCount });
          }
        } catch {
          // DB error — skip this cycle
        }
      }

      // Send initial state immediately
      await poll();

      // Close early for users with zero notifications — client falls back to 10s polling
      if (prevLatestId === "") {
        try { controller.close(); } catch {}
        return;
      }

      // Poll every 5 s for new notifications
      const pollTimer = setInterval(poll, 5000);

      // Keepalive comment ping every 30 s to prevent proxy timeouts
      const pingTimer = setInterval(() => {
        if (!req.signal.aborted) {
          try { controller.enqueue(encoder.encode(": ping\n\n")); } catch {}
        }
      }, 30000);

      req.signal.addEventListener("abort", () => {
        clearInterval(pollTimer);
        clearInterval(pingTimer);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
