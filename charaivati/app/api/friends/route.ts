// app/api/friends/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

type UserSummary = { id: string; name?: string | null; slug?: string | null; avatarUrl?: string | null };

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  // friendships: find rows where user is either A or B
  const friendships = await db.friendship.findMany({
    where: {
      OR: [
        { userAId: user.id },
        { userBId: user.id },
      ],
    },
    include: {
      userA: { select: { id: true, name: true, /* add slug/avatar if present */ } },
      userB: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // map to the "other" user
  const friends: UserSummary[] = friendships.map((f) => {
    return f.userAId === user.id ? f.userB : f.userA;
  });

  // incoming friend requests (receiverId = me)
  const incoming = await db.friendRequest.findMany({
    where: { receiverId: user.id, status: "pending" },
    include: { sender: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  // outgoing friend requests (senderId = me)
  const outgoing = await db.friendRequest.findMany({
    where: { senderId: user.id, status: "pending" },
    include: { receiver: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ok: true, friends, incoming, outgoing });
}
