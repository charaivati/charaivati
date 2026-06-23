// PICKUP-CONFIRM-1 verification — exercises the new "picked_up" milestone on
// POST/PATCH /api/order/[id]/delivery, used by DeliveriesClient's phase-aware
// Navigate button (pickup vs customer destination).
//
// Run (dev server must be up):
//   ALLOW_TEST_BYPASS=true npx ts-node --project tsconfig.scripts.json scripts/test-pickup-confirm.ts
import "dotenv/config";
import { config as dotenv } from "dotenv";
dotenv({ path: ".env.local", override: true });

import { prisma } from "../lib/prisma";

const BASE = process.env.TEST_BASE || "http://localhost:3000";
let pass = 0, fail = 0;
function check(name: string, ok: boolean, extra = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
  ok ? pass++ : fail++;
}

async function patch(orderId: string, userId: string, body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/order/${orderId}/delivery`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Test-UserId": userId },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function rawPickupConfirmedAt(orderId: string): Promise<Date | null> {
  const rows = await prisma.$queryRaw<{ pickupConfirmedAt: Date | null }[]>`
    SELECT "pickupConfirmedAt" FROM "Order" WHERE id = ${orderId} LIMIT 1
  `;
  return rows[0]?.pickupConfirmedAt ?? null;
}

async function main() {
  // Find any non-deleted store + its owner + an existing order on that store.
  const order = await prisma.order.findFirst({
    where: { store: { deletedAt: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true, storeId: true, store: { select: { ownerId: true } } },
  });
  if (!order) {
    console.log("No orders found in DB — cannot run this test.");
    process.exit(1);
  }
  const orderId = order.id;
  const ownerId = order.store.ownerId;
  console.log(`Using order ${orderId} (store owner ${ownerId})\n`);

  // 1. Owner self-assigns (baseline; does not touch pickupConfirmedAt).
  await patch(orderId, ownerId, { partnerAction: "self_assign" });
  const before = await rawPickupConfirmedAt(orderId);
  check("pickupConfirmedAt starts null", before === null, String(before));

  // 2. Mark picked up — owner is allowed (isOwner bypasses the partner-role gate).
  const pickedUp = await patch(orderId, ownerId, { partnerAction: "picked_up" });
  check("picked_up returns 200", pickedUp.status === 200, JSON.stringify(pickedUp.json));
  check("response carries pickupConfirmedAt", !!pickedUp.json?.pickupConfirmedAt, JSON.stringify(pickedUp.json));
  const afterPickup = await rawPickupConfirmedAt(orderId);
  check("DB row has pickupConfirmedAt set", afterPickup !== null, String(afterPickup));

  // 3. Forbidden for a random non-owner/non-partner user.
  const stranger = await prisma.user.findFirst({ where: { id: { not: ownerId } }, select: { id: true } });
  if (stranger) {
    const forbidden = await patch(orderId, stranger.id, { partnerAction: "picked_up" });
    check("non-owner/non-partner gets 403", forbidden.status === 403, JSON.stringify(forbidden.json));
  }

  // 4. Reassigning the delivery (owner clears assignedToId) resets pickupConfirmedAt to null —
  //    the new assignee hasn't picked up yet, regardless of what the prior one did.
  const reassigned = await patch(orderId, ownerId, { assignedToId: null });
  check("reassign PATCH returns 200", reassigned.status === 200, JSON.stringify(reassigned.json));
  const afterReassign = await rawPickupConfirmedAt(orderId);
  check("pickupConfirmedAt reset to null on reassignment", afterReassign === null, String(afterReassign));

  console.log(`\n${pass}/${pass + fail} checks passed`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
