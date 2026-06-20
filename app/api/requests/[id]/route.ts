import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { authUserId } from "@/lib/requests/common";

// PATCH /api/requests/[id] { status: "cancelled" } — requester cancels an open broadcast.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await authUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body.status !== "cancelled") return NextResponse.json({ error: "Only cancellation is supported." }, { status: 400 });

  const rows = await prisma.$queryRaw<{ requesterId: string; status: string }[]>(
    Prisma.sql`SELECT "requesterId", status FROM "RequestBroadcast" WHERE id = ${id} LIMIT 1`
  );
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (rows[0].requesterId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (rows[0].status !== "open") return NextResponse.json({ error: "Only open requests can be cancelled." }, { status: 409 });

  await prisma.$executeRaw`UPDATE "RequestBroadcast" SET status='cancelled' WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
