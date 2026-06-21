// REQBCAST-1c verification — drives the REAL HTTP endpoints with REAL minted
// sessions (same approach as 1b). Sets up fixtures via raw SQL, exercises the
// full lifecycle, asserts, then cleans up.
//
// Run (dev server must be up on :3000):
//   npx ts-node --project tsconfig.scripts.json scripts/test-reqbcast.ts
import "dotenv/config";
import { config as dotenv } from "dotenv";
dotenv({ path: ".env.local", override: true });

import { prisma } from "../lib/prisma";
import { createSessionToken, COOKIE_NAME } from "../lib/session";

const BASE = process.env.TEST_BASE || "http://localhost:3000";
const TAG = "reqbcast_test_";
let pass = 0, fail = 0;
function check(name: string, ok: boolean, extra = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
  ok ? pass++ : fail++;
}

async function api(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: `${COOKIE_NAME}=${token}`, ...(init?.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

const ORIGIN = { lat: 12.9716, lng: 77.5946 };

async function main() {
  // --- fixtures ---
  const cat = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "StoreCategory" ORDER BY "order" ASC LIMIT 1`;
  if (!cat.length) throw new Error("No StoreCategory rows — seed taxonomy first.");
  const categoryId = cat[0].id;

  const ids = {
    requester: TAG + "req", near: TAG + "near", far: TAG + "far", del: TAG + "del",
    storeNear: TAG + "snear", storeFar: TAG + "sfar", storeDel: TAG + "sdel",
  };
  await cleanup();

  await prisma.$executeRaw`INSERT INTO "User" (id, status, name, "createdAt", "updatedAt", "tokenVersion", verified, "emailVerified", discoverable, "contactVerified", "mustChangePassword") VALUES (${ids.requester}, 'active', 'ReqTester', NOW(), NOW(), 0, true, true, true, false, false)`;
  await prisma.$executeRaw`INSERT INTO "User" (id, status, name, phone, "createdAt", "updatedAt", "tokenVersion", verified, "emailVerified", discoverable, "contactVerified", "mustChangePassword") VALUES (${ids.near}, 'active', 'NearProvider', ${TAG + "9990001"}, NOW(), NOW(), 0, true, true, true, false, false)`;
  await prisma.$executeRaw`INSERT INTO "User" (id, status, name, "createdAt", "updatedAt", "tokenVersion", verified, "emailVerified", discoverable, "contactVerified", "mustChangePassword") VALUES (${ids.far}, 'active', 'FarProvider', NOW(), NOW(), 0, true, true, true, false, false)`;
  await prisma.$executeRaw`INSERT INTO "User" (id, status, name, phone, "createdAt", "updatedAt", "tokenVersion", verified, "emailVerified", discoverable, "contactVerified", "mustChangePassword") VALUES (${ids.del}, 'active', 'DeliveryRunner', ${TAG + "9990002"}, NOW(), NOW(), 0, true, true, true, false, false)`;

  // near store ~0.15km from origin, with UPI VPA; far store ~55km away
  await prisma.$executeRaw`INSERT INTO "Store" (id, name, "ownerId", lat, lng, "upiVpa", "createdAt", "acceptingOrders") VALUES (${ids.storeNear}, 'Near Services', ${ids.near}, ${ORIGIN.lat + 0.001}, ${ORIGIN.lng + 0.001}, ${"nearprovider@upi"}, NOW(), true)`;
  await prisma.$executeRaw`INSERT INTO "Store" (id, name, "ownerId", lat, lng, "createdAt", "acceptingOrders") VALUES (${ids.storeFar}, 'Far Services', ${ids.far}, ${ORIGIN.lat + 0.5}, ${ORIGIN.lng + 0.5}, NOW(), true)`;
  // delivery-only store near origin (no service block — should NOT match service requests, SHOULD match errands)
  await prisma.$executeRaw`INSERT INTO "Store" (id, name, "ownerId", lat, lng, "upiVpa", "createdAt", "acceptingOrders") VALUES (${ids.storeDel}, 'Del Runners', ${ids.del}, ${ORIGIN.lat + 0.002}, ${ORIGIN.lng + 0.002}, ${"delrunner@upi"}, NOW(), true)`;

  for (const sid of [ids.storeNear, ids.storeFar]) {
    await prisma.$executeRaw`INSERT INTO "StoreCategoryLink" ("storeId", "categoryId") VALUES (${sid}, ${categoryId})`;
    await prisma.$executeRaw`INSERT INTO "Block" (id, title, "storeId", "serviceType", visibility, "createdAt", "order", weight, "mediaType", "actionType", "blockStatus", access, mastery, "imageQuality") VALUES (${TAG + sid}, 'A service', ${sid}, 'service', 'public', NOW(), 0, 1, 'image', 'view', 'locked', 'free', 0, 0)`;
  }
  await prisma.$executeRaw`INSERT INTO "StoreCategoryLink" ("storeId", "categoryId") VALUES (${ids.storeDel}, ${categoryId})`;
  await prisma.$executeRaw`INSERT INTO "Block" (id, title, "storeId", "serviceType", visibility, "createdAt", "order", weight, "mediaType", "actionType", "blockStatus", access, mastery, "imageQuality") VALUES (${TAG + ids.storeDel}, 'Delivery', ${ids.storeDel}, 'delivery', 'public', NOW(), 0, 1, 'image', 'view', 'locked', 'free', 0, 0)`;

  const reqTok = await createSessionToken({ userId: ids.requester });
  const nearTok = await createSessionToken({ userId: ids.near });
  const farTok = await createSessionToken({ userId: ids.far });
  const delTok = await createSessionToken({ userId: ids.del });

  // --- 1. requester posts a broadcast (radius 5km) ---
  const create = await api("/api/requests", reqTok, { method: "POST", body: JSON.stringify({ categoryId, title: "Need a quick service", description: "test", addressLat: ORIGIN.lat, addressLng: ORIGIN.lng, radiusKm: 5 }) });
  check("POST /api/requests returns ok", create.status === 200 && create.body.ok, JSON.stringify(create.body));
  const bid = create.body.id;
  check("fan-out reached the NEAR provider only (eligibleCount=1)", create.body.eligibleCount === 1, `eligibleCount=${create.body.eligibleCount}, notified=${create.body.notified}`);

  // notification row for near, none for far
  const nearNotif = await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "Notification" WHERE "userId"=${ids.near} AND type='request_broadcast_created'`;
  const farNotif = await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "Notification" WHERE "userId"=${ids.far} AND type='request_broadcast_created'`;
  check("NEAR provider got a notification", Number(nearNotif[0].n) >= 1);
  check("FAR provider did NOT get a notification", Number(farNotif[0].n) === 0);
  const delServiceNotif = await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "Notification" WHERE "userId"=${ids.del} AND type='request_broadcast_created'`;
  check("delivery-only provider did NOT get the SERVICE notification (service mode unchanged)", Number(delServiceNotif[0].n) === 0);

  // --- 2. incoming visibility ---
  const incNear = await api("/api/requests/incoming", nearTok);
  check("NEAR provider sees the broadcast in /incoming", (incNear.body.broadcasts || []).some((b: any) => b.id === bid));
  const incFar = await api("/api/requests/incoming", farTok);
  check("FAR provider does NOT see the broadcast in /incoming", !(incFar.body.broadcasts || []).some((b: any) => b.id === bid), `far sees ${(incFar.body.broadcasts || []).length}`);

  // --- 3. both providers respond (far still allowed — open noticeboard) ---
  const respNear = await api(`/api/requests/${bid}/respond`, nearTok, { method: "POST", body: JSON.stringify({ quotedPrice: 250, message: "I can do it", providerStoreId: ids.storeNear }) });
  check("NEAR provider responds ok", respNear.status === 200 && respNear.body.ok);
  const respNearDup = await api(`/api/requests/${bid}/respond`, nearTok, { method: "POST", body: JSON.stringify({ quotedPrice: 300 }) });
  check("double-response blocked (409)", respNearDup.status === 409, `status=${respNearDup.status}`);
  const respFar = await api(`/api/requests/${bid}/respond`, farTok, { method: "POST", body: JSON.stringify({ quotedPrice: 400 }) });
  check("FAR provider responds ok (open noticeboard)", respFar.status === 200);
  const nearRespId = respNear.body.id;

  // --- 4. requester sees responses ---
  const mine = await api(`/api/requests`, reqTok);
  const myB = (mine.body.broadcasts || []).find((b: any) => b.id === bid);
  check("requester sees 2 responses", myB && myB.responses.length === 2, `count=${myB?.responses?.length}`);

  // --- 5. accept the NEAR response → sibling rejected, broadcast accepted, handoff VPA ---
  const accept = await api(`/api/requests/${bid}/accept`, reqTok, { method: "POST", body: JSON.stringify({ responseId: nearRespId }) });
  check("accept returns handoff with VPA", accept.status === 200 && accept.body.handoff?.vpa === "nearprovider@upi", JSON.stringify(accept.body.handoff));
  check("handoff includes provider phone", accept.body.handoff?.providerPhone === TAG + "9990001");

  const after = await prisma.$queryRaw<{ status: string; acceptedResponseId: string | null }[]>`SELECT status, "acceptedResponseId" FROM "RequestBroadcast" WHERE id=${bid}`;
  check("broadcast status = accepted", after[0].status === "accepted" && after[0].acceptedResponseId === nearRespId);
  const sib = await prisma.$queryRaw<{ status: string }[]>`SELECT status FROM "RequestResponse" WHERE "broadcastId"=${bid} AND id<>${nearRespId}`;
  check("sibling response auto-rejected", sib.length === 1 && sib[0].status === "rejected", `sib=${sib[0]?.status}`);

  // accept on a closed broadcast → 409
  const reAccept = await api(`/api/requests/${bid}/accept`, reqTok, { method: "POST", body: JSON.stringify({ responseId: nearRespId }) });
  check("re-accept on closed broadcast rejected (409)", reAccept.status === 409, `status=${reAccept.status}`);

  // --- ERRAND MODE (REQBCAST-1e) ---
  // pickup near origin, drop ~1.5km away. Eligibility anchors on PICKUP.
  const PICKUP = { lat: ORIGIN.lat, lng: ORIGIN.lng };
  const DROP = { lat: ORIGIN.lat + 0.013, lng: ORIGIN.lng + 0.005 };
  const errand = await api("/api/requests", reqTok, { method: "POST", body: JSON.stringify({
    kind: "errand", categoryId, title: "Pick up parcel, drop across town", description: "small box",
    pickupLat: PICKUP.lat, pickupLng: PICKUP.lng, pickupLabel: "Home — MG Road",
    dropLat: DROP.lat, dropLng: DROP.lng, dropLabel: "Office — Indiranagar", radiusKm: 5,
  }) });
  check("POST errand returns ok", errand.status === 200 && errand.body.ok, JSON.stringify(errand.body));
  const eid = errand.body.id;

  const erow = await prisma.$queryRaw<{ kind: string; pickupLabel: string | null; dropLabel: string | null; suggestedPrice: number | null; addressLat: number }[]>`SELECT kind, "pickupLabel", "dropLabel", "suggestedPrice", "addressLat" FROM "RequestBroadcast" WHERE id=${eid}`;
  check("errand row has kind=errand + pickup/drop labels + a suggested price hint", erow[0]?.kind === "errand" && erow[0].pickupLabel === "Home — MG Road" && erow[0].dropLabel === "Office — Indiranagar" && (erow[0].suggestedPrice ?? 0) > 0, `suggested=${erow[0]?.suggestedPrice}`);
  check("errand eligibility anchored on PICKUP (addressLat = pickupLat)", Math.abs((erow[0]?.addressLat ?? 0) - PICKUP.lat) < 1e-9);

  // both the service store AND the delivery-only store near pickup should be notified; far should not
  const delErrandNotif = await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "Notification" WHERE "userId"=${ids.del} AND type='request_broadcast_created'`;
  check("delivery-only provider GOT the errand notification", Number(delErrandNotif[0].n) >= 1);
  check("errand fan-out reached pickup-near providers (eligibleCount=2: service + delivery)", errand.body.eligibleCount === 2, `eligibleCount=${errand.body.eligibleCount}`);

  // delivery runner sees it in incoming with pickup/drop + suggested price
  const incDel = await api("/api/requests/incoming", delTok);
  const delCard = (incDel.body.broadcasts || []).find((b: any) => b.id === eid);
  check("delivery runner sees the errand in /incoming with errand fields", !!delCard && delCard.kind === "errand" && delCard.suggestedPrice > 0 && delCard.dropLabel === "Office — Indiranagar");

  // runner responds quoting a DIFFERENT price than the suggestion (pre-accept negotiation)
  const errResp = await api(`/api/requests/${eid}/respond`, delTok, { method: "POST", body: JSON.stringify({ quotedPrice: 99, message: "On it", providerStoreId: ids.storeDel }) });
  check("runner responds to errand (quoting different price)", errResp.status === 200 && errResp.body.ok);
  const errAccept = await api(`/api/requests/${eid}/accept`, reqTok, { method: "POST", body: JSON.stringify({ responseId: errResp.body.id }) });
  check("errand accept returns VPA handoff for the runner", errAccept.status === 200 && errAccept.body.handoff?.vpa === "delrunner@upi", JSON.stringify(errAccept.body.handoff));

  // --- 6. lazy expiry ---
  const staleId = TAG + "stale";
  await prisma.$executeRaw`INSERT INTO "RequestBroadcast" (id, "requesterId", kind, "categoryId", title, status, "addressLat", "addressLng", "radiusKm", "createdAt", "expiresAt") VALUES (${staleId}, ${ids.requester}, 'service', ${categoryId}, 'Stale one', 'open', ${ORIGIN.lat}, ${ORIGIN.lng}, 5, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day')`;
  const mine2 = await api(`/api/requests`, reqTok);
  const staleB = (mine2.body.broadcasts || []).find((b: any) => b.id === staleId);
  check("stale broadcast lazily marked expired on read", staleB && staleB.status === "expired", `status=${staleB?.status}`);

  console.log(`\n${pass}/${pass + fail} checks passed.`);
  await cleanup();
  await prisma.$disconnect();
  if (fail) process.exit(1);
}

async function cleanup() {
  // FKs cascade from RequestBroadcast → RequestResponse, User → everything.
  await prisma.$executeRaw`DELETE FROM "RequestResponse" WHERE id LIKE ${TAG + "%"} OR "broadcastId" IN (SELECT id FROM "RequestBroadcast" WHERE id LIKE ${TAG + "%"})`;
  await prisma.$executeRaw`DELETE FROM "RequestBroadcast" WHERE id LIKE ${TAG + "%"}`;
  await prisma.$executeRaw`DELETE FROM "Notification" WHERE "userId" LIKE ${TAG + "%"}`;
  await prisma.$executeRaw`DELETE FROM "Block" WHERE id LIKE ${TAG + "%"}`;
  await prisma.$executeRaw`DELETE FROM "StoreCategoryLink" WHERE "storeId" LIKE ${TAG + "%"}`;
  await prisma.$executeRaw`DELETE FROM "Store" WHERE id LIKE ${TAG + "%"}`;
  await prisma.$executeRaw`DELETE FROM "User" WHERE id LIKE ${TAG + "%"}`;
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
