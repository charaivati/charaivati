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
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { scanInput } from "@/lib/ai/guardRail";
import { checkRateLimit } from "@/lib/rateLimit";
import { createNotification } from "@/lib/notifications/createNotification";
import { clampReminderText } from "@/lib/listener/actions";

const REMINDERS_PER_DAY = 5;
const REMINDERS_PER_RECIPIENT_PER_HOUR = 1;

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
  if (recipientUserId === userId) {
    return NextResponse.json({ ok: false, error: "Cannot send a reminder to yourself" }, { status: 400 });
  }

  const text = clampReminderText(rawText);

  // Recipient must be an accepted friend — never allow reminders to non-friends.
  const friendship = await db.friendship.findFirst({
    where: {
      OR: [
        { userAId: userId, userBId: recipientUserId },
        { userAId: recipientUserId, userBId: userId },
      ],
    },
  });
  if (!friendship) {
    return NextResponse.json({ ok: false, error: "not_friends", message: "You can only send reminders to friends." }, { status: 403 });
  }

  const scan = scanInput(text);
  if (scan.level === "BLOCK") {
    return NextResponse.json({ ok: false, error: "blocked", message: "That reminder can't be sent — try rephrasing it." }, { status: 400 });
  }

  const dayLimit = await checkRateLimit(`listen:reminder:day:${userId}`, REMINDERS_PER_DAY, 86400);
  if (!dayLimit.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited", message: "You've sent enough reminders for today." }, { status: 429 });
  }

  const recipientLimit = await checkRateLimit(
    `listen:reminder:recipient:${userId}:${recipientUserId}`,
    REMINDERS_PER_RECIPIENT_PER_HOUR,
    3600
  );
  if (!recipientLimit.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited", message: "You already sent this person a reminder recently." }, { status: 429 });
  }

  const sender = await db.user.findUnique({ where: { id: userId }, select: { name: true } });

  await createNotification({
    userId: recipientUserId,
    type: "friend_reminder",
    title: `Reminder from ${sender?.name ?? "a friend"}`,
    body: text,
  });

  return NextResponse.json({ ok: true, message: "Reminder sent." });
}
