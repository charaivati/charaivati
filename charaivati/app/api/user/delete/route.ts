// app/api/user/delete/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, clearSessionCookie as _clearSessionCookie } from "@/lib/session";

type ApiEnvelope = { ok?: boolean; error?: string; deletionScheduledAt?: string };

async function getTokenFromReq(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const [k, ...rest] = c.split("=");
        return [k, decodeURIComponent(rest.join("="))];
      })
  );
  return (cookies["__Host-session"] ?? cookies["session"]) as string | null;
}

export async function POST(req: Request): Promise<NextResponse<ApiEnvelope>> {
  try {
    const token = await getTokenFromReq(req);
    const payload = await verifySessionToken(token);
    if (!payload) return NextResponse.json<ApiEnvelope>({ error: "Not authenticated" }, { status: 401 });

    const userId = payload.userId as string;
    if (!userId) return NextResponse.json<ApiEnvelope>({ error: "Invalid session" }, { status: 401 });

    const now = new Date();
    const deletionDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: {
        deletionScheduledAt: deletionDate,
        status: "pending_delete",
      },
    });

    // Build response and clear session cookie using generic-preserving helper
    let res = NextResponse.json<ApiEnvelope>({
      ok: true,
      deletionScheduledAt: deletionDate.toISOString(),
    });
    // import name from your helper; we named it generic-preserving in lib/session.ts
    res = _clearSessionCookie(res);
    return res;
  } catch (err) {
    console.error("user/delete error:", err);
    return NextResponse.json<ApiEnvelope>({ error: "server error" }, { status: 500 });
  }
}
