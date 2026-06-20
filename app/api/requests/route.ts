import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { authUserId, expireStale, categoryTitles, resolveHandoff } from "@/lib/requests/common";
import { findEligibleProviders } from "@/lib/requests/eligibility";
import { createNotification } from "@/lib/notifications/createNotification";
import { scanInput } from "@/lib/ai/guardRail";

// POST /api/requests — create a service request broadcast and fan out to nearby
// eligible providers. Noticeboard, not dispatcher: no assignment, no pricing.
export async function POST(req: NextRequest) {
  const userId = await authUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const categoryId = String(body.categoryId || "").trim();
  const title = String(body.title || "").trim();
  const description = body.description ? String(body.description).trim() : null;
  const addressLat = Number(body.addressLat);
  const addressLng = Number(body.addressLng);
  const radiusKm = Number(body.radiusKm) > 0 ? Number(body.radiusKm) : 5;
  const expiresHours = Number(body.expiresHours) > 0 ? Number(body.expiresHours) : 48;

  if (!categoryId || !title) return NextResponse.json({ error: "categoryId and title are required" }, { status: 400 });
  if (isNaN(addressLat) || isNaN(addressLng))
    return NextResponse.json({ error: "Your location is needed to find nearby providers." }, { status: 400 });

  // Sanitize free text (shown to providers; guard against injection just in case).
  for (const txt of [title, description].filter(Boolean) as string[]) {
    if (scanInput(txt).level === "BLOCK")
      return NextResponse.json({ error: "That text can't be posted." }, { status: 400 });
  }

  const id = randomUUID();
  const expiresAt = new Date(Date.now() + expiresHours * 3600_000);
  await prisma.$executeRaw`
    INSERT INTO "RequestBroadcast"
      (id, "requesterId", kind, "categoryId", title, description, status,
       "addressLat", "addressLng", "radiusKm", "createdAt", "expiresAt")
    VALUES
      (${id}, ${userId}, 'service', ${categoryId}, ${title}, ${description}, 'open',
       ${addressLat}, ${addressLng}, ${radiusKm}, NOW(), ${expiresAt})
  `;

  // Fan out: one notification per eligible provider (deduped by user), capped concurrency.
  const eligible = await findEligibleProviders({ categoryId, lat: addressLat, lng: addressLng, radiusKm, excludeUserId: userId });
  const providerIds = [...new Set(eligible.map((e) => e.userId))];
  let notified = 0;
  for (let i = 0; i < providerIds.length; i += 10) {
    const chunk = providerIds.slice(i, i + 10);
    const results = await Promise.allSettled(
      chunk.map((pid) =>
        createNotification({
          userId: pid,
          type: "request_broadcast_created",
          title: "New service request nearby",
          body: title,
          link: "/app/requests?tab=incoming",
        })
      )
    );
    notified += results.filter((r) => r.status === "fulfilled" && r.value).length;
  }

  return NextResponse.json({ ok: true, id, notified, eligibleCount: providerIds.length });
}

type BcastRow = {
  id: string; kind: string; categoryId: string; title: string; description: string | null;
  status: string; addressLat: number | null; addressLng: number | null; radiusKm: number;
  acceptedResponseId: string | null; createdAt: Date; expiresAt: Date | null;
};

// GET /api/requests?locale=xx — the requester's own broadcasts + responses (+ handoff when accepted).
export async function GET(req: NextRequest) {
  const userId = await authUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const locale = (new URL(req.url).searchParams.get("locale") || "en").trim() || "en";

  await expireStale();

  const broadcasts = await prisma.$queryRaw<BcastRow[]>(
    Prisma.sql`
      SELECT id, kind, "categoryId", title, description, status, "addressLat", "addressLng",
             "radiusKm", "acceptedResponseId", "createdAt", "expiresAt"
      FROM "RequestBroadcast"
      WHERE "requesterId" = ${userId}
      ORDER BY "createdAt" DESC
      LIMIT 100
    `
  );
  if (!broadcasts.length) return NextResponse.json({ broadcasts: [] });

  const ids = broadcasts.map((b) => b.id);
  const responses = await prisma.$queryRaw<{
    id: string; broadcastId: string; providerId: string; providerName: string | null;
    providerStoreId: string | null; storeName: string | null; quotedPrice: number | null;
    message: string | null; status: string; createdAt: Date;
  }[]>(
    Prisma.sql`
      SELECT rr.id, rr."broadcastId", rr."providerId", u.name AS "providerName",
             rr."providerStoreId", s.name AS "storeName", rr."quotedPrice",
             rr.message, rr.status, rr."createdAt"
      FROM "RequestResponse" rr
      JOIN "User" u ON u.id = rr."providerId"
      LEFT JOIN "Store" s ON s.id = rr."providerStoreId"
      WHERE rr."broadcastId" = ANY(${ids}::text[])
      ORDER BY rr."createdAt" ASC
    `
  );
  const respByBcast: Record<string, typeof responses> = {};
  for (const r of responses) (respByBcast[r.broadcastId] ||= []).push(r);

  const titles = await categoryTitles([...new Set(broadcasts.map((b) => b.categoryId))], locale);

  const out = await Promise.all(
    broadcasts.map(async (b) => {
      let handoff = null;
      if (b.status === "accepted" && b.acceptedResponseId) {
        const accepted = (respByBcast[b.id] || []).find((r) => r.id === b.acceptedResponseId);
        if (accepted) handoff = await resolveHandoff(accepted.providerId, accepted.providerStoreId);
      }
      return {
        ...b,
        categoryTitle: titles[b.categoryId] ?? b.categoryId,
        responses: respByBcast[b.id] || [],
        handoff,
      };
    })
  );

  return NextResponse.json({ broadcasts: out });
}
