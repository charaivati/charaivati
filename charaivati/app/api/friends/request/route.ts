// app/api/friends/request/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const receiverId = String(body?.receiverId || body?.toUserId || "").trim();
  const message = body?.message ? String(body.message).slice(0, 1000) : undefined;

  if (!receiverId) return NextResponse.json({ ok: false, error: "receiverId required" }, { status: 400 });
  if (receiverId === user.id) return NextResponse.json({ ok: false, error: "Cannot friend yourself" }, { status: 400 });

  // already friends? (check either order)
  const existingFriend = await db.friendship.findFirst({
    where: {
      OR: [
        { userAId: user.id, userBId: receiverId },
        { userAId: receiverId, userBId: user.id },
      ],
    },
  });
  if (existingFriend) return NextResponse.json({ ok: false, error: "Already friends" }, { status: 400 });

  // existing pending FriendRequest in either direction?
  const existingRequest = await db.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: user.id, receiverId, status: "pending" },
        { senderId: receiverId, receiverId: user.id, status: "pending" },
      ],
    },
  });
  if (existingRequest) return NextResponse.json({ ok: false, error: "Pending request already exists" }, { status: 400 });

  // create
  const request = await db.friendRequest.create({
    data: {
      senderId: user.id,
      receiverId,
      message,
      status: "pending",
    },
    include: {
      sender: { select: { id: true, name: true } },
      receiver: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ ok: true, request });
}
