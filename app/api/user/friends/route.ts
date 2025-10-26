// app/api/user/friends/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db"; // adjust if your db import path differs
import { getCurrentUser } from "@/lib/session"; // <-- adjust if your helper is named differently

type MinimalUser = { id: string; name?: string | null; email?: string | null; avatarUrl?: string | null };

function userToMinimal(u: any): MinimalUser {
  return {
    id: u.id,
    name: u.name ?? null,
    email: u.email ?? null,
    avatarUrl: u.avatarUrl ?? null,
  };
}

/**
 * GET: list friends + pending requests
 */
export async function GET(req: NextRequest) {
  try {
    const me = await getCurrentUser(req);
    if (!me) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // friendships: find any Friendship where userAId == me.id or userBId == me.id
    const friendships = await db.friendship.findMany({
      where: {
        OR: [{ userAId: me.id }, { userBId: me.id }],
      },
      include: {
        userA: { select: { id: true, name: true, email: true, avatarUrl: true } },
        userB: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // map to "other user"
    const friends = friendships.map((f) => {
      const other = f.userAId === me.id ? f.userB : f.userA;
      return userToMinimal(other);
    });

    // pending incoming & outgoing friend requests
    const incomingRequests = await db.friendRequest.findMany({
      where: { receiverId: me.id, status: "pending" },
      include: { sender: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const outgoingRequests = await db.friendRequest.findMany({
      where: { senderId: me.id, status: "pending" },
      include: { receiver: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({
      ok: true,
      friends,
      incomingRequests,
      outgoingRequests,
    });
  } catch (err: any) {
    console.error("GET /api/user/friends error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

/**
 * POST: create a FriendRequest (send friend request)
 * body: { receiverId: string, message?: string }
 */
export async function POST(req: Request) {
  try {
    const me = await getCurrentUser(req);
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const receiverId = String(body?.receiverId ?? "").trim();
    const message = body?.message ? String(body.message) : null;

    if (!receiverId || receiverId === me.id) {
      return NextResponse.json({ ok: false, error: "Invalid receiverId" }, { status: 400 });
    }

    // check already friends
    const already = await db.friendship.findFirst({
      where: {
        OR: [
          { userAId: me.id, userBId: receiverId },
          { userAId: receiverId, userBId: me.id },
        ],
      },
    });
    if (already) return NextResponse.json({ ok: false, error: "Already friends" }, { status: 400 });

    // check existing pending request (either direction)
    const existing = await db.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: me.id, receiverId },
          { senderId: receiverId, receiverId: me.id },
        ],
        status: "pending",
      },
    });
    if (existing) return NextResponse.json({ ok: false, error: "Friend request already pending" }, { status: 400 });

    const fr = await db.friendRequest.create({
      data: {
        senderId: me.id,
        receiverId,
        message,
      },
    });

    return NextResponse.json({ ok: true, request: fr });
  } catch (err: any) {
    console.error("POST /api/user/friends error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

/**
 * PUT: accept/reject a friend request
 * body: { requestId: string, action: "accept" | "reject" }
 */
export async function PUT(req: Request) {
  try {
    const me = await getCurrentUser(req);
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const requestId = String(body?.requestId ?? "").trim();
    const action = String(body?.action ?? "").trim();

    if (!requestId || (action !== "accept" && action !== "reject")) {
      return NextResponse.json({ ok: false, error: "Bad input" }, { status: 400 });
    }

    const fr = await db.friendRequest.findUnique({ where: { id: requestId } });
    if (!fr) return NextResponse.json({ ok: false, error: "Request not found" }, { status: 404 });
    if (fr.receiverId !== me.id) return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });

    if (action === "reject") {
      await db.friendRequest.update({ where: { id: requestId }, data: { status: "rejected" } });
      return NextResponse.json({ ok: true });
    }

    // accept: create canonical Friendship ordering (userAId < userBId) OR store as given (your schema enforces unique on [userAId,userBId])
    // We'll ensure a deterministic ordering to satisfy the unique constraint:
    const [userAId, userBId] = me.id < fr.senderId ? [me.id, fr.senderId] : [fr.senderId, me.id];

    // create friendship if not exists
    const exists = await db.friendship.findUnique({
      where: { userAId_userBId: { userAId, userBId } as any }, // this composite unique needs prisma client ts types - if you renamed the unique you can use findFirst fallback
    }).catch(() => null);

    if (!exists) {
      // fallback create via raw fields if composite unique findUnique causes type trouble
      await db.friendship.create({
        data: { userAId, userBId },
      });
    }

    // mark request accepted
    await db.friendRequest.update({ where: { id: requestId }, data: { status: "accepted" } });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("PUT /api/user/friends error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
