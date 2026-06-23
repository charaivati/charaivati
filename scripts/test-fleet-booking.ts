// FLEET-LOCPICK-1 verification — drives the REAL /api/fleet/[pageId]/book and
// /api/store/address endpoints with a REAL minted session, exercising the same
// data path the new saved-address + map/GPS picker UI relies on:
//   1. GET /api/store/address returns a usable {id,name,line1,city,lat,lng,isDefault} shape
//   2. Booking using a SAVED ADDRESS's coords as the start point (what LocSelect resolves)
//   3. Booking using an arbitrary TEMP coordinate as the drop point (what TempPicker resolves
//      from search/GPS/map-pin — the API has no idea whether a coord came from an address
//      row or a one-off pick, which is exactly the point)
//   4. The closed-fleet 422 guard still holds
//
// Run (dev server must be up on :3000):
//   npx ts-node --project tsconfig.scripts.json scripts/test-fleet-booking.ts
import "dotenv/config";
import { config as dotenv } from "dotenv";
dotenv({ path: ".env.local", override: true });

import { prisma } from "../lib/prisma";
import { createSessionToken, COOKIE_NAME } from "../lib/session";

const BASE = process.env.TEST_BASE || "http://localhost:3000";
const TAG = "fleetbook_test_";
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

const ORIGIN = { lat: 12.9716, lng: 77.5946 }; // saved-address location (Bangalore)
const DROP = { lat: 12.99, lng: 77.61 }; // ~2.4km away — simulates a map-picked/GPS drop

const ids = {
  customer: TAG + "cust",
  owner: TAG + "owner",
  page: TAG + "page",
  store: TAG + "store",
  section: TAG + "section",
  block: TAG + "block",
};

async function cleanup() {
  await prisma.order.deleteMany({ where: { userId: ids.customer } }).catch(() => {});
  await prisma.address.deleteMany({ where: { userId: ids.customer } }).catch(() => {});
  await prisma.storeBlock.deleteMany({ where: { id: ids.block } }).catch(() => {});
  await prisma.storeSection.deleteMany({ where: { id: ids.section } }).catch(() => {});
  await prisma.store.deleteMany({ where: { id: ids.store } }).catch(() => {});
  await prisma.page.deleteMany({ where: { id: ids.page } }).catch(() => {});
  await prisma.notification.deleteMany({ where: { userId: ids.owner } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: [ids.customer, ids.owner] } } }).catch(() => {});
}

async function main() {
  await cleanup();

  await prisma.user.create({ data: { id: ids.customer, status: "active", name: "FleetBookCustomer", verified: true, emailVerified: true } });
  await prisma.user.create({ data: { id: ids.owner, status: "active", name: "FleetBookOwner", verified: true, emailVerified: true } });

  // Saved address with GPS coords — exactly what GET /api/store/address must return
  // for LocSelect's saved-address dropdown to be usable.
  const addr = await prisma.address.create({
    data: { userId: ids.customer, name: "Home", phone: "9990000000", line1: "123 MG Road", city: "Bangalore", state: "KA", pincode: "560001", isDefault: true, lat: ORIGIN.lat, lng: ORIGIN.lng },
  });

  await prisma.page.create({ data: { id: ids.page, ownerId: ids.owner, title: "Test Fleet", pageType: "fleet" } });
  await prisma.store.create({ data: { id: ids.store, name: "Test Fleet Store", ownerId: ids.owner, pageId: ids.page, acceptingOrders: true } });
  await prisma.storeSection.create({ data: { id: ids.section, storeId: ids.store, title: "Fleet Services" } });
  await prisma.storeBlock.create({
    data: { id: ids.block, sectionId: ids.section, storeId: ids.store, title: "Bike Delivery", mediaType: "none", actionType: "book", serviceType: "delivery", visibility: "public", pricingModel: "per_km", price: 20, perKmRate: 10 },
  });

  const custTok = await createSessionToken({ userId: ids.customer });

  // --- 1. GET /api/store/address returns the shape LocSelect expects ---
  const addrRes = await api("/api/store/address", custTok);
  const returned = Array.isArray(addrRes.body) ? addrRes.body.find((a: any) => a.id === addr.id) : null;
  check("GET /api/store/address returns the saved address", !!returned, JSON.stringify(addrRes.body));
  check("returned address has usable lat/lng", returned?.lat === ORIGIN.lat && returned?.lng === ORIGIN.lng);

  // --- 2. Book using saved-address coords as start, temp coords as drop ---
  const book = await api(`/api/fleet/${ids.page}/book`, custTok, {
    method: "POST",
    body: JSON.stringify({
      blockId: ids.block,
      startLat: ORIGIN.lat, startLng: ORIGIN.lng, startLabel: "Home — Bangalore",
      dropLat: DROP.lat, dropLng: DROP.lng, dropLabel: "Picked on map",
    }),
  });
  check("POST /api/fleet/[pageId]/book returns 201", book.status === 201, JSON.stringify(book.body));
  const expectedDistance = Math.round(
    (() => {
      const R = 6371, dLat = (DROP.lat - ORIGIN.lat) * Math.PI / 180, dLng = (DROP.lng - ORIGIN.lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(ORIGIN.lat * Math.PI / 180) * Math.cos(DROP.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    })() * 10
  ) / 10;
  check("distanceKm matches haversine(start, drop)", Math.abs((book.body.distanceKm ?? -1) - expectedDistance) < 0.05, `got ${book.body.distanceKm}, expected ~${expectedDistance}`);
  const expectedTotal = Math.round(20 + 10 * expectedDistance);
  check("total computed from per_km pricing model", Math.abs((book.body.total ?? -1) - expectedTotal) <= 1, `got ${book.body.total}, expected ~${expectedTotal}`);

  const order = book.body.orderId ? await prisma.order.findUnique({ where: { id: book.body.orderId } }) : null;
  check("Order row created for the customer", !!order && order.userId === ids.customer);

  const notif = await prisma.notification.findFirst({ where: { userId: ids.owner, type: "order_confirmed" } });
  check("owner notified of the new booking", !!notif);

  // --- 3. Closed-fleet guard ---
  await prisma.store.update({ where: { id: ids.store }, data: { acceptingOrders: false } });
  const closedBook = await api(`/api/fleet/${ids.page}/book`, custTok, {
    method: "POST",
    body: JSON.stringify({ blockId: ids.block, startLat: ORIGIN.lat, startLng: ORIGIN.lng, dropLat: DROP.lat, dropLng: DROP.lng }),
  });
  check("booking rejected with 422 when fleet isn't accepting orders", closedBook.status === 422, JSON.stringify(closedBook.body));

  await cleanup();
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => { console.error(e); await cleanup().catch(() => {}); process.exit(1); });
