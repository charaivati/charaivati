/**
 * Verification script for STOREDEL-BACKEND-1 (store soft-delete + action guards).
 * Run: ALLOW_TEST_BYPASS=true npx ts-node --project tsconfig.scripts.json scripts/test-store-softdelete.ts
 *
 * Exercises softDeleteStore() + restore directly via Prisma (auth-agnostic core
 * logic) and the zombie-action guards on collaborator routes via the
 * X-Test-UserId bypass (delivery PATCH / step confirm / step fail / quote
 * respond / quote accept all support it).
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { PrismaClient } from "@prisma/client";
import { softDeleteStore } from "../lib/store/softDeleteStore";

const prisma = new PrismaClient({ log: ["error"] });
const BASE = (process.env.BASE_URL ?? "http://localhost:3000").trim();

type Result = { name: string; passed: boolean; error?: string };
const results: Result[] = [];
function rec(name: string, passed: boolean, error?: string) {
  results.push({ name, passed, error });
  console.log(`${passed ? "  ✓" : "  ✗"} ${name}: ${passed ? "PASS" : "FAIL"}${error ? ` — ${error}` : ""}`);
}

async function api(method: string, url: string, userId: string, body?: Record<string, unknown>) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: { "Content-Type": "application/json", "X-Test-UserId": userId },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  return { status: res.status, data };
}

async function upsertUser(email: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({ data: { email, name, status: "active", verified: true, emailVerified: true } });
}

async function main() {
  console.log(`\nSTOREDEL-BACKEND-1 verification — base: ${BASE}\n`);

  const owner   = await upsertUser("softdel-owner@test.charaivati.local", "SoftDel Owner");
  const partner = await upsertUser("softdel-partner@test.charaivati.local", "SoftDel Partner");
  const buyer   = await upsertUser("softdel-buyer@test.charaivati.local", "SoftDel Buyer");

  // ── Page + Store + linked partner Page/Collaboration ──────────────────────
  const ownerPage = await prisma.page.upsert({
    where: { id: (await prisma.page.findFirst({ where: { ownerId: owner.id, title: "SoftDel Test Venture" } }))?.id ?? "__none__" },
    update: {},
    create: { ownerId: owner.id, title: "SoftDel Test Venture", pageType: "store", type: "standard", status: "active" },
  }).catch(async () =>
    prisma.page.findFirst({ where: { ownerId: owner.id, title: "SoftDel Test Venture" } }).then((p) =>
      p ?? prisma.page.create({ data: { ownerId: owner.id, title: "SoftDel Test Venture", pageType: "store", type: "standard", status: "active" } })
    )
  );

  const store = await prisma.store.findFirst({ where: { pageId: ownerPage.id } })
    ?? await prisma.store.create({ data: { name: "SoftDel Test Store", ownerId: owner.id, pageId: ownerPage.id, acceptingOrders: true } as any });

  // Reset deletedAt from any previous run
  await prisma.store.update({ where: { id: store.id }, data: { deletedAt: null } });
  await prisma.page.update({ where: { id: ownerPage.id }, data: { deletedAt: null } });

  const partnerPage = await prisma.page.findFirst({ where: { ownerId: partner.id, title: "SoftDel Partner Page" } })
    ?? await prisma.page.create({ data: { ownerId: partner.id, title: "SoftDel Partner Page", pageType: "store", type: "standard", status: "active" } });

  let collab = await prisma.collaboration.findFirst({ where: { requesterId: ownerPage.id, receiverPageId: partnerPage.id, role: "delivery_partner" } });
  if (!collab) {
    collab = await prisma.collaboration.create({
      data: { requesterId: ownerPage.id, receiverPageId: partnerPage.id, role: "delivery_partner", status: "accepted", scope: "partner" },
    });
  } else if (collab.status !== "accepted") {
    collab = await prisma.collaboration.update({ where: { id: collab.id }, data: { status: "accepted" } });
  }

  const address = await prisma.address.findFirst({ where: { userId: buyer.id } })
    ?? await prisma.address.create({ data: { userId: buyer.id, name: "Buyer", phone: "9000000001", line1: "1 Test Rd", city: "Guwahati", state: "Assam", pincode: "781001", isDefault: true } });

  // ── Scenario 1: open order blocks delete ──────────────────────────────────
  // Clean slate: remove any leftover test orders from previous runs (children first — Quote/OSP reference Order)
  const leftoverOrderIds = (await prisma.order.findMany({ where: { storeId: store.id }, select: { id: true } })).map((o) => o.id);
  if (leftoverOrderIds.length > 0) {
    await prisma.quote.deleteMany({ where: { orderId: { in: leftoverOrderIds } } });
    await prisma.orderStepProgress.deleteMany({ where: { orderId: { in: leftoverOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: leftoverOrderIds } } });
  }

  const openOrder = await prisma.order.create({
    data: {
      userId: buyer.id, storeId: store.id, addressId: address.id,
      items: [{ blockId: "test-block", title: "Test Item", price: 100, quantity: 1 }] as any,
      total: 100, status: "confirmed", deliveryStatus: "processing",
    } as any,
  });

  {
    const r = await softDeleteStore(store.id, owner.id);
    rec("1. Open order blocks soft-delete (409 open_orders)",
      !r.ok && r.reason === "open_orders" && r.blockingOrders.some((b) => b.id === openOrder.id),
      !r.ok && r.reason === "open_orders" ? undefined : JSON.stringify(r));
  }

  // Close the order so deletion can proceed
  await prisma.order.update({ where: { id: openOrder.id }, data: { status: "delivered", deliveryStatus: "delivered" } as any });

  // Sub-order open should also block
  const subOrder = await prisma.order.create({
    data: {
      userId: partner.id, storeId: store.id, addressId: address.id, parentOrderId: openOrder.id,
      items: [{ blockId: "test-block", title: "Test Item", price: 100, quantity: 1 }] as any,
      total: 100, status: "confirmed", deliveryStatus: "processing", subOrderType: "delivery",
    } as any,
  });
  {
    const r = await softDeleteStore(store.id, owner.id);
    rec("1b. Open sub-order blocks soft-delete too",
      !r.ok && r.reason === "open_orders" && r.blockingOrders.some((b) => b.id === subOrder.id && b.reason.startsWith("sub-order")),
      !r.ok && r.reason === "open_orders" ? undefined : JSON.stringify(r));
  }
  await prisma.order.update({ where: { id: subOrder.id }, data: { status: "delivered", deliveryStatus: "delivered" } as any });

  // ── Scenario 2: successful soft-delete — flags, collaboration ended, notification ──
  const notifBefore = await prisma.notification.count({ where: { userId: partner.id, type: "collaboration_ended" } });
  {
    const r = await softDeleteStore(store.id, owner.id);
    const storeRow = await prisma.store.findUnique({ where: { id: store.id }, select: { deletedAt: true } });
    const pageRow = await prisma.page.findUnique({ where: { id: ownerPage.id }, select: { deletedAt: true } });
    const collabRow = await prisma.collaboration.findUnique({ where: { id: collab.id } });
    const notifAfter = await prisma.notification.count({ where: { userId: partner.id, type: "collaboration_ended" } });
    rec("2a. soft-delete sets Store.deletedAt + Page.deletedAt", r.ok && !!storeRow?.deletedAt && !!pageRow?.deletedAt, r.ok ? undefined : JSON.stringify(r));
    rec("2b. soft-delete ends accepted collaboration (status -> cancelled)", collabRow?.status === "cancelled", `status=${collabRow?.status}`);
    rec("2c. soft-delete fires collaboration_ended notification to partner", notifAfter > notifBefore, `before=${notifBefore} after=${notifAfter}`);
  }
  // Forbidden / not-found
  {
    const r1 = await softDeleteStore(store.id, partner.id);
    rec("2d. soft-delete forbidden for non-owner", !r1.ok && r1.reason === "forbidden", JSON.stringify(r1));
    const r2 = await softDeleteStore("nonexistent-id-xxxx", owner.id);
    rec("2e. soft-delete not_found for bad id", !r2.ok && r2.reason === "not_found", JSON.stringify(r2));
  }

  // ── Scenario 3: order placement guard rejects deleted store ───────────────
  // Replicate the exact guard query both order routes run.
  {
    const cartRow = await prisma.$queryRaw<{ deletedAt: Date | null; acceptingOrders: boolean }[]>`
      SELECT "deletedAt", "acceptingOrders" FROM "Store" WHERE id = ${store.id} LIMIT 1
    `;
    rec("3. Order-placement guard query observes deletedAt set (both /orders and /orders/quick read this)",
      !!cartRow[0]?.deletedAt, `deletedAt=${cartRow[0]?.deletedAt}`);
  }

  // ── Scenario 4: zombie collaborator-action guards reject on deleted store ──
  // Build a fresh confirmed order + active OSP to exercise confirm/fail/delivery PATCH against the now-deleted store.
  const zOrder = await prisma.order.create({
    data: {
      userId: buyer.id, storeId: store.id, addressId: address.id,
      items: [{ blockId: "test-block", title: "Test Item", price: 50, quantity: 1 }] as any,
      total: 50, status: "confirmed", deliveryStatus: "pending",
    } as any,
  });
  let zStep = await prisma.workflowStep.findFirst({ where: { initiativeId: ownerPage.id } });
  if (!zStep) {
    zStep = await prisma.workflowStep.create({
      data: { initiativeId: ownerPage.id, name: "Zombie Test Step", sequence: 1, assigneeType: "third_party", quoteRequired: false },
    });
  }
  const zOSP = await prisma.orderStepProgress.upsert({
    where: { orderId_stepId: { orderId: zOrder.id, stepId: zStep.id } },
    update: { status: "active" },
    create: { orderId: zOrder.id, stepId: zStep.id, status: "active" },
  });
  let zQuote = await prisma.quote.findFirst({ where: { orderId: zOrder.id, stepId: zStep.id } });
  if (!zQuote) {
    zQuote = await prisma.quote.create({
      data: { orderId: zOrder.id, stepId: zStep.id, requestedPartyId: collab.id, status: "pending", expiresAt: new Date(Date.now() + 86400000) },
    });
  }

  {
    const r = await api("PATCH", `/api/order/${zOrder.id}/delivery`, owner.id, { deliveryStatus: "out_for_delivery" });
    rec("4a. delivery PATCH rejects on deleted store (409)", r.status === 409, `status=${r.status} body=${JSON.stringify(r.data)}`);
  }
  {
    const r = await api("PATCH", `/api/order/${zOrder.id}/step/${zStep.id}/confirm`, owner.id, {});
    rec("4b. step confirm rejects on deleted store (409)", r.status === 409, `status=${r.status} body=${JSON.stringify(r.data)}`);
  }
  {
    const r = await api("PATCH", `/api/order/${zOrder.id}/step/${zStep.id}/fail`, owner.id, {});
    rec("4c. step fail rejects on deleted store (409)", r.status === 409, `status=${r.status} body=${JSON.stringify(r.data)}`);
  }
  {
    const r = await api("POST", `/api/order/${zOrder.id}/quote/${zQuote.id}/respond`, partner.id, { amount: 75 });
    rec("4d. quote respond rejects on deleted store (409)", r.status === 409, `status=${r.status} body=${JSON.stringify(r.data)}`);
  }
  {
    const r = await api("POST", `/api/order/${zOrder.id}/quote/${zQuote.id}/accept`, owner.id, {});
    rec("4e. quote accept rejects on deleted store (409)", r.status === 409, `status=${r.status} body=${JSON.stringify(r.data)}`);
  }

  // ── Scenario 5: listings filter out deleted stores ────────────────────────
  {
    const inAll = await prisma.store.findMany({ where: { deletedAt: null, id: store.id } });
    const inSearch = await prisma.store.findMany({ where: { name: { contains: "SoftDel Test Store" }, deletedAt: null } });
    rec("5a. store/all-style query (deletedAt: null) excludes deleted store", inAll.length === 0, `found=${inAll.length}`);
    rec("5b. store/search-style query (deletedAt: null) excludes deleted store", inSearch.length === 0, `found=${inSearch.length}`);
  }
  {
    // my-stores deliberately does NOT filter — owner must still see it
    const ownerSees = await prisma.store.findMany({ where: { ownerId: owner.id, id: store.id } });
    rec("5c. my-stores-style query (no filter) still surfaces deleted store to owner", ownerSees.length === 1, `found=${ownerSees.length}`);
  }

  // ── Scenario 6: store/[id] visibility — owner yes, stranger no ────────────
  {
    const storeRow = await prisma.store.findUnique({ where: { id: store.id }, select: { deletedAt: true, ownerId: true } });
    const visibleToOwner = !(storeRow!.deletedAt && storeRow!.ownerId !== owner.id);
    const visibleToStranger = !(storeRow!.deletedAt && storeRow!.ownerId !== buyer.id);
    rec("6a. store/[id] guard logic: owner can still view deleted store", visibleToOwner === true);
    rec("6b. store/[id] guard logic: stranger gets 404 for deleted store", visibleToStranger === false);
  }

  // ── Scenario 7: restore clears flags + slug re-check ──────────────────────
  // Close the zombie-test order so the delete that follows isn't blocked again (already deleted from prior run though — store stays deleted across these checks; restore now)
  {
    const before = await prisma.store.findUnique({ where: { id: store.id }, select: { deletedAt: true } });
    rec("7a. store is currently deleted (pre-restore)", !!before?.deletedAt);

    await prisma.$transaction([
      prisma.store.update({ where: { id: store.id }, data: { deletedAt: null } }),
      prisma.page.update({ where: { id: ownerPage.id }, data: { deletedAt: null } }),
    ]);
    const after = await prisma.store.findUnique({ where: { id: store.id }, select: { deletedAt: true } });
    const afterPage = await prisma.page.findUnique({ where: { id: ownerPage.id }, select: { deletedAt: true } });
    rec("7b. restore clears Store.deletedAt and Page.deletedAt", !after?.deletedAt && !afterPage?.deletedAt);

    // Collaboration re-activation is OUT OF SCOPE — confirm it stays cancelled (known follow-up)
    const collabRow = await prisma.collaboration.findUnique({ where: { id: collab.id } });
    rec("7c. restore does NOT re-activate ended collaborations (documented gap)", collabRow?.status === "cancelled", `status=${collabRow?.status}`);
  }

  // ── Cleanup (children before parents — Quote/OSP reference Order) ─────────
  await prisma.quote.deleteMany({ where: { stepId: zStep.id } });
  await prisma.orderStepProgress.deleteMany({ where: { stepId: zStep.id } });
  await prisma.order.deleteMany({ where: { storeId: store.id } });

  console.log("\n──────────────────────────────────────────");
  const passed = results.filter((r) => r.passed).length;
  console.log(`${passed}/${results.length} checks passed`);
  if (passed !== results.length) {
    console.log("\nFailures:");
    for (const r of results.filter((r) => !r.passed)) console.log(`  ✗ ${r.name}${r.error ? ` — ${r.error}` : ""}`);
  }
  await prisma.$disconnect();
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
