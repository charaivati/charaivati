// app/api/users/unblock/route.ts
//
// ACTION-INTENT-6: reverses POST /api/users/block — deletes the UserBlock row
// only. Does NOT restore the friendship or any deleted FriendRequest; the
// other side can be re-friended normally afterward.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const targetUserId = String(body?.targetUserId || body?.userId || "").trim();

  if (!targetUserId) return NextResponse.json({ ok: false, error: "targetUserId required" }, { status: 400 });

  const deleted = await (db as any).userBlock.deleteMany({
    where: { blockerId: user.id, blockedId: targetUserId },
  });

  return NextResponse.json({ ok: true, deletedCount: deleted.count });
}
