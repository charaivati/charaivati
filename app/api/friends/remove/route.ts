// app/api/friends/remove/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canonicalPair } from "../utils";

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const otherId = String(body?.friendId || body?.userId || "").trim();
  if (!otherId) return NextResponse.json({ ok: false, error: "friendId required" }, { status: 400 });

  const { userAId, userBId } = canonicalPair(user.id, otherId);

  // delete canonical friendship row
  const deleted = await db.friendship.deleteMany({
    where: { userAId, userBId },
  });

  return NextResponse.json({ ok: true, deletedCount: deleted.count });
}
