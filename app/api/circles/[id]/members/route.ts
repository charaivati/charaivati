// app/api/circles/[id]/members/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canonicalPair } from "@/app/api/friends/utils";

async function isFriend(userAId: string, userBId: string): Promise<boolean> {
  const pair = canonicalPair(userAId, userBId);
  const friendship = await db.friendship.findUnique({
    where: { userAId_userBId: pair },
  });
  return !!friendship;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const circle = await db.friendCircle.findUnique({ where: { id: params.id } });
  if (!circle || circle.ownerId !== user.id)
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "").trim();
  if (!userId) return NextResponse.json({ ok: false, error: "userId required" }, { status: 400 });

  if (userId === user.id)
    return NextResponse.json({ ok: false, error: "Cannot add yourself" }, { status: 400 });

  const friends = await isFriend(user.id, userId);
  if (!friends)
    return NextResponse.json({ ok: false, error: "User is not your friend" }, { status: 400 });

  const member = await db.friendCircleMember.upsert({
    where: { circleId_userId: { circleId: params.id, userId } },
    create: { circleId: params.id, userId },
    update: {},
    include: {
      user: { select: { id: true, name: true, avatarUrl: true, profile: { select: { displayName: true } } } },
    },
  });

  return NextResponse.json({ ok: true, member }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const circle = await db.friendCircle.findUnique({ where: { id: params.id } });
  if (!circle || circle.ownerId !== user.id)
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "").trim();
  if (!userId) return NextResponse.json({ ok: false, error: "userId required" }, { status: 400 });

  await db.friendCircleMember.deleteMany({
    where: { circleId: params.id, userId },
  });

  return NextResponse.json({ ok: true });
}
