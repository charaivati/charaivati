import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { authUserId, resolveHandoff } from "@/lib/requests/common";
import { createNotification } from "@/lib/notifications/createNotification";

// POST /api/requests/[id]/accept { responseId } — requester accepts ONE response.
// Mirrors the Quote accept transaction: accepted response wins, siblings auto-reject,
// broadcast closes. Acceptance closes any pre-acceptance price negotiation — there is
// no post-accept bargaining flow. Reveals the VPA handoff; that's where noticeboard ends.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: broadcastId } = await params;
  const userId = await authUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const responseId = String(body.responseId || "").trim();
  if (!responseId) return NextResponse.json({ error: "responseId required" }, { status: 400 });

  const bcast = await prisma.$queryRaw<{ requesterId: string; status: string; title: string }[]>(
    Prisma.sql`SELECT "requesterId", status, title FROM "RequestBroadcast" WHERE id = ${broadcastId} LIMIT 1`
  );
  if (!bcast.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (bcast[0].requesterId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (bcast[0].status !== "open") return NextResponse.json({ error: "This request is no longer open." }, { status: 409 });

  const resp = await prisma.$queryRaw<{ providerId: string; providerStoreId: string | null; status: string }[]>(
    Prisma.sql`SELECT "providerId", "providerStoreId", status FROM "RequestResponse" WHERE id = ${responseId} AND "broadcastId" = ${broadcastId} LIMIT 1`
  );
  if (!resp.length) return NextResponse.json({ error: "Response not found" }, { status: 404 });

  // Atomic: accept this one, reject siblings, close the broadcast.
  await prisma.$transaction([
    prisma.$executeRaw`UPDATE "RequestResponse" SET status='accepted' WHERE id = ${responseId}`,
    prisma.$executeRaw`UPDATE "RequestResponse" SET status='rejected' WHERE "broadcastId" = ${broadcastId} AND id <> ${responseId} AND status='pending'`,
    prisma.$executeRaw`UPDATE "RequestBroadcast" SET status='accepted', "acceptedResponseId" = ${responseId} WHERE id = ${broadcastId}`,
  ]);

  // Notify accepted + rejected providers.
  await createNotification({
    userId: resp[0].providerId,
    type: "request_accepted",
    title: "Your response was accepted",
    body: bcast[0].title,
    link: "/app/requests?tab=incoming",
  });
  const rejected = await prisma.$queryRaw<{ providerId: string }[]>(
    Prisma.sql`SELECT "providerId" FROM "RequestResponse" WHERE "broadcastId" = ${broadcastId} AND status='rejected'`
  );
  for (const r of rejected) {
    createNotification({
      userId: r.providerId,
      type: "request_rejected",
      title: "A request went to another provider",
      body: bcast[0].title,
      link: "/app/requests?tab=incoming",
    }).catch(() => {});
  }

  const handoff = await resolveHandoff(resp[0].providerId, resp[0].providerStoreId);
  return NextResponse.json({ ok: true, handoff });
}
