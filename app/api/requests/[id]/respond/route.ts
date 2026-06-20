import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { authUserId } from "@/lib/requests/common";
import { createNotification } from "@/lib/notifications/createNotification";
import { scanInput } from "@/lib/ai/guardRail";

// POST /api/requests/[id]/respond — a provider responds to an open broadcast,
// optionally with a quoted price (pre-acceptance negotiation only). The unique
// (broadcastId, providerId) constraint blocks double-responses.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: broadcastId } = await params;
  const userId = await authUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const quotedPrice = body.quotedPrice != null && Number(body.quotedPrice) >= 0 ? Number(body.quotedPrice) : null;
  const message = body.message ? String(body.message).trim() : null;
  const providerStoreId = body.providerStoreId ? String(body.providerStoreId) : null;

  if (message && scanInput(message).level === "BLOCK")
    return NextResponse.json({ error: "That message can't be sent." }, { status: 400 });

  const bcast = await prisma.$queryRaw<{ requesterId: string; status: string; title: string }[]>(
    Prisma.sql`SELECT "requesterId", status, title FROM "RequestBroadcast" WHERE id = ${broadcastId} LIMIT 1`
  );
  if (!bcast.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (bcast[0].requesterId === userId) return NextResponse.json({ error: "You can't respond to your own request." }, { status: 400 });
  if (bcast[0].status !== "open") return NextResponse.json({ error: "This request is no longer open." }, { status: 409 });

  // Validate store ownership if responding as a store.
  if (providerStoreId) {
    const owns = await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM "Store" WHERE id = ${providerStoreId} AND "ownerId" = ${userId} AND "deletedAt" IS NULL LIMIT 1`
    );
    if (!owns.length) return NextResponse.json({ error: "Invalid store." }, { status: 400 });
  }

  const id = randomUUID();
  try {
    await prisma.$executeRaw`
      INSERT INTO "RequestResponse" (id, "broadcastId", "providerId", "providerStoreId", "quotedPrice", message, status, "createdAt")
      VALUES (${id}, ${broadcastId}, ${userId}, ${providerStoreId}, ${quotedPrice}, ${message}, 'pending', NOW())
    `;
  } catch (e: any) {
    if (e?.code === "P2010" || /unique|duplicate|23505/i.test(String(e?.message)))
      return NextResponse.json({ error: "You've already responded to this request." }, { status: 409 });
    throw e;
  }

  await createNotification({
    userId: bcast[0].requesterId,
    type: "request_response_submitted",
    title: "Someone responded to your request",
    body: bcast[0].title,
    link: "/app/requests?tab=mine",
  });

  return NextResponse.json({ ok: true, id });
}
