// app/api/friends/add/route.ts
import { NextResponse } from "next/server";
import {prisma} from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json();
  const { targetId, message } = body;

  if (targetId === user.id) return NextResponse.json({ error: "Can't friend yourself" }, { status: 400 });

  const existing = await prisma.friendRequest.findFirst({
    where: { senderId: user.id, receiverId: targetId, status: "pending" }
  });
  if (existing) return NextResponse.json({ ok: true, message: "Request already sent" });

  await prisma.friendRequest.create({
    data: { senderId: user.id, receiverId: targetId, message }
  });
  return NextResponse.json({ ok: true });
}
