// app/api/users/block/route.ts
//
// ACTION-INTENT-6: block is one-directional in intent (A blocks B) but
// bilateral in effect (B can no longer see/contact A either — see
// lib/users/searchUsers.ts and app/api/friends/request/route.ts). Blocking
// auto-unfriends the pair and clears any pending FriendRequest in either
// direction. Idempotent — blocking someone already blocked is a no-op success.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canonicalPair } from "@/app/api/friends/utils";

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const targetUserId = String(body?.targetUserId || body?.userId || "").trim();

  if (!targetUserId) return NextResponse.json({ ok: false, error: "targetUserId required" }, { status: 400 });
  if (targetUserId === user.id) return NextResponse.json({ ok: false, error: "Cannot block yourself" }, { status: 400 });

  await (db as any).userBlock.upsert({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId: targetUserId } },
    update: {},
    create: { blockerId: user.id, blockedId: targetUserId },
  });

  const { userAId, userBId } = canonicalPair(user.id, targetUserId);
  await db.friendship.deleteMany({ where: { userAId, userBId } });

  await db.friendRequest.deleteMany({
    where: {
      OR: [
        { senderId: user.id, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: user.id },
      ],
      status: "pending",
    },
  });

  return NextResponse.json({ ok: true });
}
