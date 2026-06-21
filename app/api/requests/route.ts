import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { authUserId, expireStale, categoryTitles, resolveHandoff } from "@/lib/requests/common";
import { findEligibleProviders } from "@/lib/requests/eligibility";
import { createNotification } from "@/lib/notifications/createNotification";
import { scanInput } from "@/lib/ai/guardRail";
import { suggestErrandPriceHint } from "@/lib/requests/suggestErrandPriceHint";

// POST /api/requests — create a request broadcast and fan out to nearby eligible
// providers. Noticeboard, not dispatcher: no assignment, no pricing.
//   kind="service" (default): anchor eligibility on the requester's location.
//   kind="errand": GOODS/TASKS pick-and-drop only (NO passengers). Anchor
//   eligibility on the PICKUP point (the runner must reach pickup first), store
//   pickup/drop + a DISPLAY-ONLY suggested price.
export async function POST(req: NextRequest) {
  const userId = await authUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const kind = body.kind === "errand" ? "errand" : "service";
  const categoryId = String(body.categoryId || "").trim();
  const title = String(body.title || "").trim();
  const description = body.description ? String(body.description).trim() : null;
  const radiusKm = Number(body.radiusKm) > 0 ? Number(body.radiusKm) : 5;
  const expiresHours = Number(body.expiresHours) > 0 ? Number(body.expiresHours) : 48;

  if (!categoryId || !title) return NextResponse.json({ error: "categoryId and title are required" }, { status: 400 });

  // Errand-specific geometry; service uses a single origin.
  let originLat: number, originLng: number;
  let pickupLat: number | null = null, pickupLng: number | null = null, pickupLabel: string | null = null;
  let dropLat: number | null = null, dropLng: number | null = null, dropLabel: string | null = null;
  let suggestedPrice: number | null = null;

  if (kind === "errand") {
    pickupLat = Number(body.pickupLat); pickupLng = Number(body.pickupLng);
    dropLat = Number(body.dropLat); dropLng = Number(body.dropLng);
    if ([pickupLat, pickupLng, dropLat, dropLng].some((n) => isNaN(n)))
      return NextResponse.json({ error: "Pickup and drop locations are needed." }, { status: 400 });
    pickupLabel = body.pickupLabel ? String(body.pickupLabel).trim().slice(0, 200) : null;
    dropLabel = body.dropLabel ? String(body.dropLabel).trim().slice(0, 200) : null;
    suggestedPrice = suggestErrandPriceHint(pickupLat, pickupLng, dropLat, dropLng);
    // Eligibility anchors on PICKUP — the runner must reach the pickup first.
    originLat = pickupLat; originLng = pickupLng;
  } else {
    originLat = Number(body.addressLat); originLng = Number(body.addressLng);
    if (isNaN(originLat) || isNaN(originLng))
      return NextResponse.json({ error: "Your location is needed to find nearby providers." }, { status: 400 });
  }

  // Sanitize free text (shown to providers; guard against injection just in case).
  for (const txt of [title, description, pickupLabel, dropLabel].filter(Boolean) as string[]) {
    if (scanInput(txt).level === "BLOCK")
      return NextResponse.json({ error: "That text can't be posted." }, { status: 400 });
  }

  const id = randomUUID();
  const expiresAt = new Date(Date.now() + expiresHours * 3600_000);
  // For errands, addressLat/Lng = pickup, so the incoming reverse-eligibility query
  // (which measures from addressLat/Lng) naturally anchors on pickup with no change.
  await prisma.$executeRaw`
    INSERT INTO "RequestBroadcast"
      (id, "requesterId", kind, "categoryId", title, description, status,
       "addressLat", "addressLng", "radiusKm",
       "pickupLat", "pickupLng", "pickupLabel", "dropLat", "dropLng", "dropLabel", "suggestedPrice",
       "createdAt", "expiresAt")
    VALUES
      (${id}, ${userId}, ${kind}, ${categoryId}, ${title}, ${description}, 'open',
       ${originLat}, ${originLng}, ${radiusKm},
       ${pickupLat}, ${pickupLng}, ${pickupLabel}, ${dropLat}, ${dropLng}, ${dropLabel}, ${suggestedPrice},
       NOW(), ${expiresAt})
  `;

  // Fan out: one notification per eligible provider (deduped by user), capped concurrency.
  const serviceTypes = kind === "errand" ? ["service", "delivery"] : ["service"];
  const eligible = await findEligibleProviders({ categoryId, lat: originLat, lng: originLng, radiusKm, excludeUserId: userId, serviceTypes });
  const providerIds = [...new Set(eligible.map((e) => e.userId))];
  const notifTitle = kind === "errand" ? "New errand nearby" : "New service request nearby";
  let notified = 0;
  for (let i = 0; i < providerIds.length; i += 10) {
    const chunk = providerIds.slice(i, i + 10);
    const results = await Promise.allSettled(
      chunk.map((pid) =>
        createNotification({
          userId: pid,
          type: "request_broadcast_created",
          title: notifTitle,
          body: title,
          link: "/app/orders?tab=requests",
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
  pickupLabel: string | null; dropLabel: string | null; suggestedPrice: number | null;
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
             "radiusKm", "acceptedResponseId", "createdAt", "expiresAt",
             "pickupLabel", "dropLabel", "suggestedPrice"
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
