// app/api/listen/actions/friend-request/route.ts
//
// PRIV-ACT-1: deterministic confirmation endpoint for the Listener's friend-
// request action. Called by ListenChat after the user taps a person card and
// confirms — never a raw model side effect. Mirrors the checks in
// POST /api/friends/request.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export async function POST(req: Request) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const userId = payload.userId;

  const body = await req.json().catch(() => ({}));
  const targetUserId = String(body?.targetUserId ?? "").trim();
  if (!targetUserId) {
    return NextResponse.json({ ok: false, error: "targetUserId required" }, { status: 400 });
  }
  if (targetUserId === userId) {
    return NextResponse.json({ ok: false, error: "Cannot friend yourself" }, { status: 400 });
  }

  // ACTION-INTENT-6: bilateral block effect — neutral, non-leaky error (never
  // reveals who blocked whom). Mirrors POST /api/friends/request.
  const blocked = await (db as any).userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: targetUserId },
        { blockerId: targetUserId, blockedId: userId },
      ],
    },
  });
  if (blocked) {
    return NextResponse.json({ ok: false, error: "blocked", message: "Couldn't send a friend request." }, { status: 400 });
  }

  const existingFriend = await db.friendship.findFirst({
    where: {
      OR: [
        { userAId: userId, userBId: targetUserId },
        { userAId: targetUserId, userBId: userId },
      ],
    },
  });
  if (existingFriend) {
    return NextResponse.json({ ok: false, error: "already_friends", message: "You're already friends with this person." }, { status: 400 });
  }

  const existingRequest = await db.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: userId, receiverId: targetUserId, status: "pending" },
        { senderId: targetUserId, receiverId: userId, status: "pending" },
      ],
    },
  });
  if (existingRequest) {
    return NextResponse.json({ ok: false, error: "pending_request", message: "A friend request is already pending." }, { status: 400 });
  }

  await db.friendRequest.create({
    data: {
      senderId: userId,
      receiverId: targetUserId,
      status: "pending",
    },
  });

  return NextResponse.json({ ok: true, message: "Friend request sent." });
}
