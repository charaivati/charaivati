// app/api/friends/decline/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const requestId = String(body?.requestId || "").trim();
  if (!requestId) return NextResponse.json({ ok: false, error: "requestId required" }, { status: 400 });

  const fr = await db.friendRequest.findUnique({ where: { id: requestId } });
  if (!fr) return NextResponse.json({ ok: false, error: "Request not found" }, { status: 404 });
  if (fr.receiverId !== user.id) return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });

  await db.friendRequest.update({ where: { id: requestId }, data: { status: "rejected" } });

  return NextResponse.json({ ok: true });
}
