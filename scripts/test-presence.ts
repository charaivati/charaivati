// FLEET-STATE-1b P1 verification — presence + live-matching against the REAL
// endpoints. Proves: (b) eligibility matches from LIVE presence not static store,
// (e) offline stops matching, (f) stale (>5min) treated as offline. The 25-check
// static-provider regression is covered by test-reqbcast.ts.
//
//   TEST_BASE=http://localhost:3001 npx ts-node --project tsconfig.scripts.json scripts/test-presence.ts
import "dotenv/config";
import { config as dotenv } from "dotenv";
dotenv({ path: ".env.local", override: true });

import { prisma } from "../lib/prisma";
import { createSessionToken, COOKIE_NAME } from "../lib/session";
import { findEligibleProviders } from "../lib/requests/eligibility";

const BASE = process.env.TEST_BASE || "http://localhost:3000";
const TAG = "presence_test_";
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, extra = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); ok ? pass++ : fail++; };

async function api(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { "Content-Type": "application/json", Cookie: `${COOKIE_NAME}=${token}`, ...(init?.headers || {}) } });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

// Origin near a request; the provider's STORE is parked ~55km away (far). Only a
// LIVE presence near origin can make them match — proving live-not-static.
const ORIGIN = { lat: 12.9716, lng: 77.5946 };
const FAR = { lat: ORIGIN.lat + 0.5, lng: ORIGIN.lng + 0.5 }; // ~70km

async function matchesNearOrigin(categoryId: string): Promise<boolean> {
  const e = await findEligibleProviders({ categoryId, lat: ORIGIN.lat, lng: ORIGIN.lng, radiusKm: 5 });
  return e.some((p) => p.userId === TAG + "prov");
}

async function main() {
  const cat = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "StoreCategory" ORDER BY "order" ASC LIMIT 1`;
  const categoryId = cat[0].id;
  await cleanup();

  await prisma.$executeRaw`INSERT INTO "User" (id, status, name, "createdAt", "updatedAt", "tokenVersion", verified, "emailVerified", discoverable, "contactVerified", "mustChangePassword") VALUES (${TAG + "prov"}, 'active', 'FleetProv', NOW(), NOW(), 0, true, true, true, false, false)`;
  // store parked FAR from origin
  await prisma.$executeRaw`INSERT INTO "Store" (id, name, "ownerId", lat, lng, "createdAt", "acceptingOrders") VALUES (${TAG + "store"}, 'Fleet Store', ${TAG + "prov"}, ${FAR.lat}, ${FAR.lng}, NOW(), true)`;
  await prisma.$executeRaw`INSERT INTO "StoreCategoryLink" ("storeId", "categoryId") VALUES (${TAG + "store"}, ${categoryId})`;
  await prisma.$executeRaw`INSERT INTO "Block" (id, title, "storeId", "serviceType", visibility, "createdAt", "order", weight, "mediaType", "actionType", "blockStatus", access, mastery, "imageQuality") VALUES (${TAG + "blk"}, 'A service', ${TAG + "store"}, 'service', 'public', NOW(), 0, 1, 'image', 'view', 'locked', 'free', 0, 0)`;
  const tok = await createSessionToken({ userId: TAG + "prov" });

  // baseline: store is far → no match near origin
  check("(baseline) static-only provider does NOT match (store is 70km away)", !(await matchesNearOrigin(categoryId)));

  // (a) toggle ON → POST presence near origin
  const on = await api("/api/presence", tok, { method: "POST", body: JSON.stringify({ mode: "available", lat: ORIGIN.lat + 0.001, lng: ORIGIN.lng + 0.001 }) });
  check("(a) POST /api/presence available → ok", on.status === 200 && on.body.ok);
  const row = await prisma.$queryRaw<{ mode: string; seenAt: Date | null; lat: number }[]>`SELECT mode, "seenAt", lat FROM "ProviderPresence" WHERE "userId"=${TAG + "prov"}`;
  check("presence row created mode=available, seenAt set, live coords stored", row[0]?.mode === "available" && !!row[0].seenAt && Math.abs(row[0].lat - (ORIGIN.lat + 0.001)) < 1e-9);

  // (b) eligibility now matches from LIVE presence position, not the far store
  check("(b) provider matches near origin via LIVE presence (not static store)", await matchesNearOrigin(categoryId));

  // (f) stale presence (>5min) treated as offline → no match even though mode='available'
  await prisma.$executeRaw`UPDATE "ProviderPresence" SET "seenAt" = NOW() - INTERVAL '6 minutes' WHERE "userId"=${TAG + "prov"}`;
  check("(f) stale presence (seenAt > 5min) treated as offline → no match", !(await matchesNearOrigin(categoryId)));

  // refresh, confirm matches again, then (e) toggle OFF
  await api("/api/presence", tok, { method: "POST", body: JSON.stringify({ mode: "available", lat: ORIGIN.lat + 0.001, lng: ORIGIN.lng + 0.001 }) });
  check("(re-fresh) matches again after a fresh report", await matchesNearOrigin(categoryId));
  const off = await api("/api/presence", tok, { method: "POST", body: JSON.stringify({ mode: "offline" }) });
  check("(e) POST offline → ok", off.status === 200 && off.body.mode === "offline");
  check("(e) offline presence → no match (falls back to far store)", !(await matchesNearOrigin(categoryId)));

  console.log(`\n${pass}/${pass + fail} checks passed.`);
  await cleanup();
  await prisma.$disconnect();
  if (fail) process.exit(1);
}

async function cleanup() {
  await prisma.$executeRaw`DELETE FROM "ProviderPresence" WHERE "userId" LIKE ${TAG + "%"}`;
  await prisma.$executeRaw`DELETE FROM "Block" WHERE id LIKE ${TAG + "%"}`;
  await prisma.$executeRaw`DELETE FROM "StoreCategoryLink" WHERE "storeId" LIKE ${TAG + "%"}`;
  await prisma.$executeRaw`DELETE FROM "Store" WHERE id LIKE ${TAG + "%"}`;
  await prisma.$executeRaw`DELETE FROM "User" WHERE id LIKE ${TAG + "%"}`;
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
