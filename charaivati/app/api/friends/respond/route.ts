// app/api/friends/respond/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// helper to canonicalize ordering for Friendship unique constraint
function canonicalPair(a: string, b: string) {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const requestId = String(body?.requestId || "").trim();
  const action = String(body?.action || "").trim(); // "accept" or "reject"
  if (!requestId || (action !== "accept" && action !== "reject")) {
    return NextResponse.json({ ok: false, error: "requestId and valid action required" }, { status: 400 });
  }

  const fr = await db.friendRequest.findUnique({ where: { id: requestId } });
  if (!fr) return NextResponse.json({ ok: false, error: "Friend request not found" }, { status: 404 });
  if (fr.receiverId !== user.id) return NextResponse.json({ ok: false, error: "Not permitted" }, { status: 403 });
  if (fr.status !== "pending") return NextResponse.json({ ok: false, error: "Request not pending" }, { status: 400 });

  if (action === "reject") {
    await db.friendRequest.update({ where: { id: requestId }, data: { status: "rejected" } });
    return NextResponse.json({ ok: true });
  }

  // action === "accept" -> mark accepted and create friendship (canonical order)
  const { userAId, userBId } = canonicalPair(fr.senderId, fr.receiverId);

  // transaction: update request + create friendship (unique constraint prevents duplicate)
  await db.$transaction([
    db.friendRequest.update({ where: { id: requestId }, data: { status: "accepted" } }),
    db.friendship.create({ data: { userAId, userBId } }),
  ]);

  return NextResponse.json({ ok: true });
}
