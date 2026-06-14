// app/api/listen/clear/route.ts
//
// ACTION-INTENT-3: confirmation endpoint for the "clear chat" action.
// Fold-don't-delete doctrine — ConsultMessage rows are NEVER deleted here.
// ACTION-INTENT-5c: chatResetAt is now READ by both GET (display) and POST
// (model window) in /api/listen — a clear genuinely hides pre-reset
// ConsultMessage rows going forward (the rows themselves are untouched).
//
// rollingSummary/foldedThrough reset (ACTION-INTENT-5c): a pre-clear
// rollingSummary could keep feeding cleared content into the model's prompt
// forever, so it's blanked here. foldedThrough is advanced to the same
// timestamp as chatResetAt, establishing the invariant foldedThrough >=
// chatResetAt going forward — /api/listen's windowBoundary = max(...) then
// never needs to fall back below this reset point, and a later fold can
// never pull pre-reset rows back into rollingSummary.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export async function POST(req: Request) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const session = await (db as any).consultSession.findUnique({
    where: { userId: payload.userId },
  });
  if (!session) {
    return NextResponse.json({ ok: true });
  }

  const now = new Date();
  await (db as any).consultSession.update({
    where: { id: session.id },
    data: { chatResetAt: now, rollingSummary: "", foldedThrough: now },
  });

  return NextResponse.json({ ok: true });
}
