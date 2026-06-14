// app/api/listen/actions/reminder/route.ts
//
// PRIV-ACT-1: deterministic confirmation endpoint for the Listener's friend-
// reminder action. Called by ListenChat after the user confirms a reminder
// card — never a raw model side effect.
//
// Recipient privacy is absolute: this delivers a Notification to the
// recipient and returns only a generic "sent" result to the sender — no
// delivery/read receipts, and nothing about the recipient's account is read
// or returned beyond what was already shown on the confirm card.
import { NextResponse } from "next/server";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { sendReminder } from "@/lib/listener/actions";

export async function POST(req: Request) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const userId = payload.userId;

  const body = await req.json().catch(() => ({}));
  const recipientUserId = String(body?.recipientUserId ?? "").trim();
  const rawText = String(body?.text ?? "").trim();
  if (!recipientUserId || !rawText) {
    return NextResponse.json({ ok: false, error: "recipientUserId and text required" }, { status: 400 });
  }

  const result = await sendReminder(userId, recipientUserId, rawText);

  if (!result.ok) {
    const status =
      result.error === "not_friends" ? 403 :
      result.error === "rate_limited_day" || result.error === "rate_limited_recipient" ? 429 :
      result.error === "blocked" ? 400 :
      500;
    return NextResponse.json({ ok: false, error: result.error, message: result.message }, { status });
  }

  return NextResponse.json({ ok: true, message: "Reminder sent." });
}
