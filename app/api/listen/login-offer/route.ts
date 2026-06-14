// app/api/listen/login-offer/route.ts
//
// ACTION-INTENT-3: bookkeeping for the LOGIN offer (SecureChatCard) shown in
// the Listener's empty state. GET /api/listen stays read-only — this route
// records when the offer was shown and whether the user declined it, so it
// can be re-offered on a cooldown (or never again, once declined).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export async function POST(req: Request) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action === "dismiss" ? "dismiss" : "shown";

  const session = await (db as any).consultSession.upsert({
    where: { userId: payload.userId },
    create: { userId: payload.userId, language: "en" },
    update: {},
  });

  await (db as any).consultSession.update({
    where: { id: session.id },
    data:
      action === "dismiss"
        ? { loginDeclined: true, loginLastAskedAt: new Date() }
        : { loginLastAskedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
