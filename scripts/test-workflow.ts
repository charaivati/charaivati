/**
 * End-to-end workflow integration test.
 * Run: ALLOW_TEST_BYPASS=true npx ts-node --project tsconfig.scripts.json scripts/test-workflow.ts
 *
 * Requires:
 *  - ALLOW_TEST_BYPASS=true in .env.local
 *  - Next.js dev server running at BASE_URL (default http://localhost:3000)
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });
const BASE   = (process.env.BASE_URL ?? "http://localhost:3000").trim();

// ── Result tracking ───────────────────────────────────────────────────────────

type Result = { name: string; passed: boolean; error?: string };
const results: Result[] = [];

function rec(name: string, passed: boolean, error?: string) {
  results.push({ name, passed, error });
  const icon = passed ? "  ✓" : "  ✗";
  const tag  = passed ? "PASS" : "FAIL";
  console.log(`${icon} ${name}: ${tag}${error ? ` — ${error}` : ""}`);
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function api(
  method: string,
  url: string,
  userId: string,
  body?: Record<string, unknown>
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      "Content-Type":   "application/json",
      "X-Test-UserId":  userId,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  return { status: res.status, data };
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// ── Setup helpers ─────────────────────────────────────────────────────────────

async function upsertUser(email: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({ data: { email, name, status: "active", verified: true, emailVerified: true } });
}

async function upsertPage(ownerId: string, title: string, pageType: string) {
  const existing = await prisma.page.findFirst({
    where: { ownerId, title, pageType },
  });
  if (existing) return existing;
  return prisma.page.create({ data: { ownerId, title, pageType, type: "standard", status: "active" } });
}

async function upsertStore(ownerId: string, pageId: string) {
  const existing = await prisma.store.findFirst({ where: { pageId } });
  if (existing) return existing;
  return prisma.store.create({ data: { name: "Test Store", ownerId, pageId } });
}

async function upsertAddress(userId: string) {
  const existing = await prisma.address.findFirst({ where: { userId } });
  if (existing) return existing;
  return prisma.address.create({
    data: { userId, name: "Test Customer", phone: "9000000000", line1: "123 Test St", city: "Guwahati", state: "Assam", pincode: "781001", isDefault: true },
  });
}

async function upsertCollab(
  requesterId: string,
  receiverId: string,
  role: string,
  extra: { scope: string; teamRole: string | null; initiativeId: string }
) {
  const existing = await prisma.collaboration.findFirst({
    where: { requesterId, receiverId, role },
  });
  if (existing) {
    return prisma.collaboration.update({
      where: { id: existing.id },
      data: { status: "accepted", scope: extra.scope, teamRole: extra.teamRole, initiativeId: extra.initiativeId },
    });
  }
  return prisma.collaboration.create({
    data: { requesterId, receiverId, role, status: "accepted", scope: extra.scope, teamRole: extra.teamRole, initiativeId: extra.initiativeId },
  });
}

async function seedWorkflowSteps(
  initiativeId: string,
  delivCollabId: string,
  thirdCollabId: string
) {
  // Remove existing steps for this initiative to ensure clean state
  await prisma.workflowStep.deleteMany({ where: { initiativeId } });

  const [s1, s2, s3] = await prisma.$transaction([
    prisma.workflowStep.create({
      data: {
        initiativeId,
        name: "Order Received",
        sequence: 1,
        assigneeType: "team_member",
        assigneeId: delivCollabId,
        quoteRequired: false,
        quoteTimeoutHours: 24,
      },
    }),
    prisma.workflowStep.create({
      data: {
        initiativeId,
        name: "Packaging",
        sequence: 2,
        assigneeType: "third_party",
        assigneeId: null,
        assigneeIds: [thirdCollabId],
        quoteRequired: true,
        quoteTimeoutHours: 1,
      },
    }),
    prisma.workflowStep.create({
      data: {
        initiativeId,
        name: "Dispatch & Deliver",
        sequence: 3,
        assigneeType: "team_member",
        assigneeId: delivCollabId,
        quoteRequired: false,
        quoteTimeoutHours: 24,
        assignmentMode: "sequential",
      },
    }),
  ]);
  return [s1, s2, s3];
}

// Inline activateWorkflow — avoids importing @/* path-aliased helpers
async function runActivateWorkflow(orderId: string, initiativeId: string) {
  const steps = await prisma.workflowStep.findMany({
    where: { initiativeId },
    orderBy: { sequence: "asc" },
  });
  if (steps.length === 0) return;

  const existing = await prisma.orderStepProgress.count({ where: { orderId } });
  if (existing > 0) {
    await prisma.orderStepProgress.deleteMany({ where: { orderId } });
  }

  await prisma.orderStepProgress.createMany({
    data: steps.map((s) => ({ orderId, stepId: s.id, status: "pending" })),
    skipDuplicates: true,
  });

  const first = steps[0];
  await prisma.orderStepProgress.update({
    where: { orderId_stepId: { orderId, stepId: first.id } },
    data: { status: "active", activatedAt: new Date() },
  });

  if (!first.quoteRequired && first.assigneeId) {
    await prisma.order.update({
      where: { id: orderId },
      data: { assignedToId: first.assigneeId, partnerStatus: "assigned" },
    });
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  Charaivati Workflow Integration Test");
  console.log(`  Target: ${BASE}`);
  console.log("=".repeat(60));

  // ── SETUP ─────────────────────────────────────────────────────────────────
  console.log("\n[SETUP] Creating test data…");

  const owner      = await upsertUser("test-owner@charaivati.test",      "Test Owner");
  const customer   = await upsertUser("test-customer@charaivati.test",   "Test Customer");
  const delivery   = await upsertUser("test-delivery@charaivati.test",   "Test Delivery");
  const thirdparty = await upsertUser("test-thirdparty@charaivati.test", "Test ThirdParty");

  const ownerPage   = await upsertPage(owner.id,      "Test Store Initiative", "store");
  const delivPage   = await upsertPage(delivery.id,   "Test Delivery Co",      "store");
  const thirdPage   = await upsertPage(thirdparty.id, "Test Third Party",      "store");
  const initiative  = await upsertPage(owner.id,      "Test Initiative",       "helping");

  const store   = await upsertStore(owner.id, ownerPage.id);
  const address = await upsertAddress(customer.id);

  const delivCollab = await upsertCollab(ownerPage.id, delivPage.id, "employee", {
    scope: "team", teamRole: "employee", initiativeId: initiative.id,
  });
  const thirdCollab = await upsertCollab(ownerPage.id, thirdPage.id, "supplier", {
    scope: "third_party", teamRole: null, initiativeId: initiative.id,
  });

  const [step1, step2, step3] = await seedWorkflowSteps(
    initiative.id, delivCollab.id, thirdCollab.id
  );

  console.log(`  owner:     ${owner.id}`);
  console.log(`  customer:  ${customer.id}`);
  console.log(`  store:     ${store.id}  (page: ${ownerPage.id})`);
  console.log(`  initiative:${initiative.id}`);
  console.log(`  delivCollab: ${delivCollab.id}  thirdCollab: ${thirdCollab.id}`);
  console.log(`  steps: ${step1.id.slice(-6)} / ${step2.id.slice(-6)} / ${step3.id.slice(-6)}`);
  console.log("");

  // ── TEST 1: Place Order ───────────────────────────────────────────────────
  console.log("[TEST 1] Place Order");
  let orderId = "";
  try {
    const order = await prisma.order.create({
      data: {
        userId:    customer.id,
        storeId:   store.id,
        addressId: address.id,
        status:    "pending",
        total:     100.0,
        items:     [{ blockId: "test-block", title: "Test Product", price: 100, quantity: 1, imageUrl: null }],
      },
    });
    orderId = order.id;
    rec("Place Order", true);
  } catch (e: unknown) {
    rec("Place Order", false, String(e));
  }

  if (!orderId) {
    console.log("\n[FATAL] Cannot continue without orderId.");
    await cleanup({ customer, owner, delivery, thirdparty, store, ownerPage, delivPage, thirdPage, initiative, orderIds: [] });
    await prisma.$disconnect();
    return;
  }

  // ── TEST 2: Confirm Order → Workflow Activates ────────────────────────────
  console.log("\n[TEST 2] Confirm Order → Workflow Activates");
  await prisma.order.update({ where: { id: orderId }, data: { status: "confirmed" } });
  await runActivateWorkflow(orderId, initiative.id);

  const osps = await prisma.orderStepProgress.findMany({
    where: { orderId },
    orderBy: { step: { sequence: "asc" } },
    include: { step: { select: { sequence: true, name: true } } },
  });

  rec("3 OSP rows created", osps.length === 3, `found ${osps.length}`);
  rec("Step 1 OSP active", osps[0]?.status === "active", osps[0]?.status);

  const orderAfterActivate = await prisma.order.findUnique({
    where: { id: orderId },
    select: { assignedToId: true },
  });
  rec("Order.assignedToId = delivCollab",
    orderAfterActivate?.assignedToId === delivCollab.id,
    `got: ${orderAfterActivate?.assignedToId?.slice(-6)}`
  );

  // ── TEST 3: Confirm Step 1 via HTTP ───────────────────────────────────────
  console.log("\n[TEST 3] Confirm Step 1");
  const r3 = await api("PATCH", `/api/order/${orderId}/step/${step1.id}/confirm`, owner.id);
  if (r3.status !== 200) {
    rec("HTTP confirm step 1", false, `status ${r3.status}: ${JSON.stringify(r3.data)}`);
  } else {
    rec("HTTP confirm step 1", true);

    const osp1 = await prisma.orderStepProgress.findUnique({
      where: { orderId_stepId: { orderId, stepId: step1.id } },
    });
    rec("Step 1 OSP confirmed", osp1?.status === "confirmed", osp1?.status);

    const osp2 = await prisma.orderStepProgress.findUnique({
      where: { orderId_stepId: { orderId, stepId: step2.id } },
    });
    rec("Step 2 OSP active", osp2?.status === "active", osp2?.status);

    // Wait briefly for async quote creation
    await sleep(600);

    const quotes = await prisma.quote.findMany({ where: { orderId, stepId: step2.id } });
    rec("Quote rows created for thirdparty", quotes.length > 0, `found ${quotes.length}`);
  }

  // ── TEST 4: Submit Quote ───────────────────────────────────────────────────
  console.log("\n[TEST 4] Submit Quote");
  const quotes = await prisma.quote.findMany({ where: { orderId, stepId: step2.id } });
  if (quotes.length === 0) {
    rec("Quote exists to respond to", false, "no quotes found");
  } else {
    const quote = quotes[0];
    const r4 = await api("POST", `/api/order/${orderId}/quote/${quote.id}/respond`, thirdparty.id, { amount: 150 });
    if (r4.status !== 200) {
      rec("HTTP respond to quote", false, `status ${r4.status}: ${JSON.stringify(r4.data)}`);
    } else {
      rec("HTTP respond to quote", true);

      const qUpdated = await prisma.quote.findUnique({ where: { id: quote.id } });
      rec("Quote status = submitted", qUpdated?.status === "submitted", qUpdated?.status);
      rec("Quote amount = 150", qUpdated?.amount === 150, String(qUpdated?.amount));

      const oAfterQ = await prisma.order.findUnique({
        where: { id: orderId },
        select: { quoteSummary: true },
      });
      rec("Order.quoteSummary set", oAfterQ?.quoteSummary != null);
    }
  }

  // ── TEST 5: Accept Quote ───────────────────────────────────────────────────
  console.log("\n[TEST 5] Accept Quote");
  const quotesForAccept = await prisma.quote.findMany({
    where: { orderId, stepId: step2.id, status: "submitted" },
  });
  if (quotesForAccept.length === 0) {
    rec("Submitted quote exists", false, "none found");
  } else {
    const qToAccept = quotesForAccept[0];
    const r5 = await api("POST", `/api/order/${orderId}/quote/${qToAccept.id}/accept`, owner.id);
    if (r5.status !== 200) {
      rec("HTTP accept quote", false, `status ${r5.status}: ${JSON.stringify(r5.data)}`);
    } else {
      rec("HTTP accept quote", true);

      const qAccepted = await prisma.quote.findUnique({ where: { id: qToAccept.id } });
      rec("Quote status = accepted", qAccepted?.status === "accepted", qAccepted?.status);

      const osp2a = await prisma.orderStepProgress.findUnique({
        where: { orderId_stepId: { orderId, stepId: step2.id } },
      });
      rec("Step 2 OSP confirmed", osp2a?.status === "confirmed", osp2a?.status);

      const osp3 = await prisma.orderStepProgress.findUnique({
        where: { orderId_stepId: { orderId, stepId: step3.id } },
      });
      rec("Step 3 OSP active", osp3?.status === "active", osp3?.status);

      const oAfterAccept = await prisma.order.findUnique({
        where: { id: orderId },
        select: { assignedToId: true, deliveryStatus: true },
      });
      // After accept, advanceToNextStep immediately activates step 3 (delivery)
      // and sets assignedToId = step3.assigneeId = delivCollab.id
      rec("Order.assignedToId = delivCollab (step 3 activated)",
        oAfterAccept?.assignedToId === delivCollab.id,
        `got: ${oAfterAccept?.assignedToId?.slice(-6)}`
      );
      rec("Order.deliveryStatus = out_for_delivery",
        oAfterAccept?.deliveryStatus === "out_for_delivery",
        oAfterAccept?.deliveryStatus
      );
    }
  }

  // ── TEST 6: Delivery Partner Confirms Delivery ────────────────────────────
  console.log("\n[TEST 6] Delivery Partner Confirms Step 3");
  const r6 = await api("PATCH", `/api/order/${orderId}/step/${step3.id}/confirm`, delivery.id);
  if (r6.status !== 200) {
    rec("HTTP confirm step 3 (delivery)", false, `status ${r6.status}: ${JSON.stringify(r6.data)}`);
  } else {
    rec("HTTP confirm step 3 (delivery)", true);

    const osp3c = await prisma.orderStepProgress.findUnique({
      where: { orderId_stepId: { orderId, stepId: step3.id } },
    });
    rec("Step 3 OSP confirmed", osp3c?.status === "confirmed", osp3c?.status);

    const oAfterD = await prisma.order.findUnique({
      where: { id: orderId },
      select: { deliveryStatus: true },
    });
    rec("Order.deliveryStatus still out_for_delivery",
      oAfterD?.deliveryStatus === "out_for_delivery",
      oAfterD?.deliveryStatus
    );
  }

  // ── TEST 7: Customer Confirms Receipt ─────────────────────────────────────
  console.log("\n[TEST 7] Customer Confirms Receipt");
  const r7 = await api("POST", `/api/order/${orderId}/customer-confirm`, customer.id);
  if (r7.status !== 200) {
    rec("HTTP customer-confirm", false, `status ${r7.status}: ${JSON.stringify(r7.data)}`);
  } else {
    rec("HTTP customer-confirm", true);

    const oFinal = await prisma.order.findUnique({
      where: { id: orderId },
      select: { deliveryStatus: true, partnerStatus: true },
    });
    rec("Order.deliveryStatus = delivered",
      oFinal?.deliveryStatus === "delivered",
      oFinal?.deliveryStatus
    );
    rec("Order.partnerStatus = completed",
      oFinal?.partnerStatus === "completed",
      oFinal?.partnerStatus
    );
  }

  // ── GROUP 8: WorkflowStepAssignee setup ───────────────────────────────────
  console.log("\n[GROUP 8] WorkflowStepAssignee Setup");

  // Create 5th test user: delivery2
  const delivery2   = await upsertUser("test-delivery2@charaivati.test", "Test Delivery 2");
  const delivPage2  = await upsertPage(delivery2.id, "Test Delivery Co 2", "store");
  const newCollab   = await upsertCollab(ownerPage.id, delivPage2.id, "employee", {
    scope: "team", teamRole: "employee", initiativeId: initiative.id,
  });

  rec("delivery2 user created", !!delivery2.id, delivery2.id);
  rec("delivPage2 page created", !!delivPage2.id, delivPage2.id);
  rec("newCollab created", !!newCollab.id, newCollab.id);

  // Create WorkflowStepAssignee rows for step3 (Dispatch & Deliver)
  let stepAssignee1: any;
  let stepAssignee2: any;
  try {
    // Upsert assignee 1: delivery1 collab, sequence=1, costPerOrder=50
    stepAssignee1 = await (prisma as any).workflowStepAssignee.upsert({
      where: { stepId_collaborationId: { stepId: step3.id, collaborationId: delivCollab.id } },
      create: { stepId: step3.id, collaborationId: delivCollab.id, sequence: 1, costPerOrder: 50 },
      update: { sequence: 1, costPerOrder: 50, costPerKg: null, costPerKgPerKm: null, costPerItemPerKm: null },
    });
    // Upsert assignee 2: delivery2 collab, sequence=2, costPerOrder=60
    stepAssignee2 = await (prisma as any).workflowStepAssignee.upsert({
      where: { stepId_collaborationId: { stepId: step3.id, collaborationId: newCollab.id } },
      create: { stepId: step3.id, collaborationId: newCollab.id, sequence: 2, costPerOrder: 60 },
      update: { sequence: 2, costPerOrder: 60, costPerKg: null, costPerKgPerKm: null, costPerItemPerKm: null },
    });
    rec("WorkflowStepAssignee rows created for step3", true);
  } catch (e) {
    rec("WorkflowStepAssignee rows created for step3", false, String(e));
  }

  // Set step3.assignmentMode = "sequential"
  try {
    await prisma.workflowStep.update({
      where: { id: step3.id },
      data: { assignmentMode: "sequential" },
    });
    const updatedStep3 = await prisma.workflowStep.findUnique({
      where: { id: step3.id },
      select: { assignmentMode: true },
    });
    rec("step3.assignmentMode = sequential", updatedStep3?.assignmentMode === "sequential", updatedStep3?.assignmentMode ?? "");
  } catch (e) {
    rec("step3.assignmentMode = sequential", false, String(e));
  }

  // ── GROUP 9: First partner assignment ─────────────────────────────────────
  console.log("\n[GROUP 9] First Partner Assignment");

  let order2Id = "";
  try {
    const order2 = await prisma.order.create({
      data: {
        userId:    customer.id,
        storeId:   store.id,
        addressId: address.id,
        status:    "pending",
        total:     100.0,
        items:     [{ blockId: "test-block", title: "Test Product", price: 100, quantity: 1, imageUrl: null }],
      },
    });
    order2Id = order2.id;
    rec("Order2 placed", true);
  } catch (e) {
    rec("Order2 placed", false, String(e));
  }

  if (!order2Id) {
    console.log("  [SKIP] Cannot test cycling without order2Id.");
  } else {
    // Confirm order2 and run inline activate
    await prisma.order.update({ where: { id: order2Id }, data: { status: "confirmed" } });
    await runActivateWorkflow(order2Id, initiative.id);

    // Confirm step1 via HTTP (owner) → activates step2 (quote step)
    const r9s1 = await api("PATCH", `/api/order/${order2Id}/step/${step1.id}/confirm`, owner.id);
    if (r9s1.status !== 200) {
      rec("Order2 step1 confirmed", false, `status ${r9s1.status}: ${JSON.stringify(r9s1.data)}`);
    } else {
      rec("Order2 step1 confirmed", true);
    }
    await sleep(500);

    // Confirm step2 via HTTP (owner) → activates step3 → assignNextPartner fires (fire-and-forget)
    // First set step2 OSP active (it should already be after step1 confirm, but verify)
    const osp2_9 = await prisma.orderStepProgress.findUnique({
      where: { orderId_stepId: { orderId: order2Id, stepId: step2.id } },
    });
    if (osp2_9?.status !== "active") {
      // If step2 is not active for some reason, set it directly
      await prisma.orderStepProgress.update({
        where: { orderId_stepId: { orderId: order2Id, stepId: step2.id } },
        data: { status: "active", activatedAt: new Date() },
      });
    }

    const r9s2 = await api("PATCH", `/api/order/${order2Id}/step/${step2.id}/confirm`, owner.id);
    if (r9s2.status !== 200) {
      rec("Order2 step2 confirmed", false, `status ${r9s2.status}: ${JSON.stringify(r9s2.data)}`);
    } else {
      rec("Order2 step2 confirmed", true);
    }

    // Brief wait for any remaining async work in the confirm route
    await sleep(1000);

    // Check step3 OSP active
    const osp3_9 = await prisma.orderStepProgress.findUnique({
      where: { orderId_stepId: { orderId: order2Id, stepId: step3.id } },
    });
    rec("Order2 step3 OSP active", osp3_9?.status === "active", osp3_9?.status ?? "null");

    // Check assignment results
    const osp3Raw = await (prisma as any).orderStepProgress.findUnique({
      where: { orderId_stepId: { orderId: order2Id, stepId: step3.id } },
    });
    rec("OSP.currentAssigneeId = stepAssignee1",
      osp3Raw?.currentAssigneeId === stepAssignee1?.id,
      `got: ${osp3Raw?.currentAssigneeId?.slice(-6) ?? "null"}`
    );

    const order2After = await (prisma as any).order.findUnique({
      where: { id: order2Id },
      select: { assignedToId: true, partnerStatus: true, agreedAmount: true },
    });
    rec("Order2.assignedToId = delivCollab",
      order2After?.assignedToId === delivCollab.id,
      `got: ${order2After?.assignedToId?.slice(-6) ?? "null"}`
    );
    rec("Order2.agreedAmount = 50",
      order2After?.agreedAmount === 50,
      `got: ${order2After?.agreedAmount}`
    );
    rec("Order2.partnerStatus = assigned",
      order2After?.partnerStatus === "assigned",
      order2After?.partnerStatus
    );

    // Check sub-order for delivery user
    const subOrder9 = await (prisma as any).order.findFirst({
      where: { parentOrderId: order2Id, userId: delivery.id },
      select: { id: true },
    });
    rec("Sub-order exists for delivery user", !!subOrder9, subOrder9?.id?.slice(-6) ?? "none");

    // Check notification for delivery user
    const notif9 = await (prisma as any).notification.findFirst({
      where: { userId: delivery.id, type: "order_assigned" },
      orderBy: { createdAt: "desc" },
    });
    rec("Notification exists for delivery user", !!notif9, notif9?.id?.slice(-6) ?? "none");

    // ── PART 4: GPS Simulation ─────────────────────────────────────────────
    console.log("\n[PART 4] GPS Simulation");
    const vehicleId = "test-gps-delivery";

    // Create vehicle directly in DB
    try {
      await prisma.vehicle.upsert({
        where: { id: vehicleId },
        create: { id: vehicleId, busNumber: vehicleId, vehicleType: "Bus", lat: 22.5726, lng: 88.3639 },
        update: { lat: 22.5726, lng: 88.3639, updatedAt: new Date() },
      });
      rec("Vehicle created in DB", true);
    } catch (e) {
      rec("Vehicle created in DB", false, String(e));
    }

    // Accept delivery as delivery1 via PATCH (partnerAction: "accept")
    const rAccept = await api("PATCH", `/api/order/${order2Id}/delivery`, delivery.id, { partnerAction: "accept" });
    rec("delivery1 accepted order2", rAccept.status === 200, `status ${rAccept.status}`);

    // PATCH order2 vehicleId via delivery route (as delivery1 partner)
    const rVehicle = await api("PATCH", `/api/order/${order2Id}/delivery`, delivery.id, { vehicleId });
    rec("Order2 vehicleId patched", rVehicle.status === 200, `status ${rVehicle.status}`);

    // Update vehicle coords in DB (simulate movement)
    try {
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: { lat: 22.5730, lng: 88.3645, updatedAt: new Date() },
      });
      rec("Vehicle coords updated in DB", true);
    } catch (e) {
      rec("Vehicle coords updated in DB", false, String(e));
    }

    // GET /api/transport/vehicles?id=vehicleId — no auth needed
    const rGps = await fetch(`${BASE}/api/transport/vehicles?id=${vehicleId}`);
    const gpsData = await rGps.json().catch(() => ({ vehicles: [] }));
    const found = (gpsData.vehicles ?? []).find((v: any) => v.id === vehicleId);
    rec("GET vehicles returns vehicle", !!found, found ? `lat:${found.lat}` : "not found");
    rec("Vehicle lat updated to 22.5730",
      Math.abs((found?.lat ?? 0) - 22.5730) < 0.0001,
      `lat: ${found?.lat}`
    );
    rec("Vehicle lng updated to 88.3645",
      Math.abs((found?.lng ?? 0) - 88.3645) < 0.0001,
      `lng: ${found?.lng}`
    );

    // Clean up vehicle + reset order vehicleId for cycling tests
    await prisma.vehicle.delete({ where: { id: vehicleId } }).catch(() => {});
    await (prisma as any).order.update({
      where: { id: order2Id },
      data: { vehicleId: null, partnerStatus: "assigned" },
    });

    // ── GROUP 10: Rejection cycles to delivery2 ────────────────────────────
    console.log("\n[GROUP 10] Rejection Cycles to delivery2");

    const r10 = await api("PATCH", `/api/order/${order2Id}/delivery`, delivery.id, { partnerAction: "reject" });
    rec("delivery1 rejected order2", r10.status === 200, `status ${r10.status}: ${JSON.stringify(r10.data)}`);

    const osp3_10 = await (prisma as any).orderStepProgress.findUnique({
      where: { orderId_stepId: { orderId: order2Id, stepId: step3.id } },
    });
    rec("OSP.currentAssigneeId = stepAssignee2",
      osp3_10?.currentAssigneeId === stepAssignee2?.id,
      `got: ${osp3_10?.currentAssigneeId?.slice(-6) ?? "null"}`
    );

    const order2_10 = await (prisma as any).order.findUnique({
      where: { id: order2Id },
      select: { assignedToId: true, partnerStatus: true, agreedAmount: true },
    });
    rec("Order2.assignedToId = newCollab",
      order2_10?.assignedToId === newCollab.id,
      `got: ${order2_10?.assignedToId?.slice(-6) ?? "null"}`
    );
    rec("Order2.agreedAmount = 60",
      order2_10?.agreedAmount === 60,
      `got: ${order2_10?.agreedAmount}`
    );
    rec("Order2.partnerStatus = assigned (delivery2)",
      order2_10?.partnerStatus === "assigned",
      order2_10?.partnerStatus
    );

    const notif10 = await (prisma as any).notification.findFirst({
      where: { userId: delivery2.id, type: "order_assigned" },
      orderBy: { createdAt: "desc" },
    });
    rec("Notification exists for delivery2", !!notif10, notif10?.id?.slice(-6) ?? "none");

    // ── GROUP 11: Full cycle rejection → 5% hike ──────────────────────────
    console.log("\n[GROUP 11] Full Cycle Rejection → 5% Fee Hike");

    const r11 = await api("PATCH", `/api/order/${order2Id}/delivery`, delivery2.id, { partnerAction: "reject" });
    rec("delivery2 rejected order2", r11.status === 200, `status ${r11.status}`);

    const osp3_11 = await (prisma as any).orderStepProgress.findUnique({
      where: { orderId_stepId: { orderId: order2Id, stepId: step3.id } },
    });
    rec("OSP.cycleCount = 1",
      osp3_11?.cycleCount === 1,
      `got: ${osp3_11?.cycleCount}`
    );
    rec("OSP.lastFeeMultiplier = 1.05",
      Math.abs((osp3_11?.lastFeeMultiplier ?? 0) - 1.05) < 0.0001,
      `got: ${osp3_11?.lastFeeMultiplier}`
    );

    const order2_11 = await (prisma as any).order.findUnique({
      where: { id: order2Id },
      select: { assignedToId: true, agreedAmount: true },
    });
    rec("Order2.assignedToId = delivCollab (back to top)",
      order2_11?.assignedToId === delivCollab.id,
      `got: ${order2_11?.assignedToId?.slice(-6) ?? "null"}`
    );
    // 50 * 1.05 = 52.5
    rec("Order2.agreedAmount = 52.5",
      Math.abs((order2_11?.agreedAmount ?? 0) - 52.5) < 0.01,
      `got: ${order2_11?.agreedAmount}`
    );

    // ── GROUP 12: Escalation after 3 cycles ───────────────────────────────
    console.log("\n[GROUP 12] Escalation After 3 Cycles");

    // State after GROUP 11: cycleCount=1, delivery1 assigned at 52.5
    // 4 more rejections: del1→del2→(cycle=2)→del1→del2→(cycle=3, escalate)
    const rejectors = [
      { user: delivery,  label: "delivery1" },  // del1 rejects → del2 assigned
      { user: delivery2, label: "delivery2" },  // del2 rejects → cycle=2, del1 assigned
      { user: delivery,  label: "delivery1" },  // del1 rejects → del2 assigned
      { user: delivery2, label: "delivery2" },  // del2 rejects → cycle=3 → ESCALATION
    ];

    for (let i = 0; i < rejectors.length; i++) {
      const { user: rejUser, label } = rejectors[i];
      const rRej = await api("PATCH", `/api/order/${order2Id}/delivery`, rejUser.id, { partnerAction: "reject" });
      const isLast = i === rejectors.length - 1;
      rec(
        `Rejection ${i + 1} (${label})`,
        rRej.status === 200,
        `status ${rRej.status}${isLast ? " (escalation expected)" : ""}`
      );
    }

    const osp3_12 = await (prisma as any).orderStepProgress.findUnique({
      where: { orderId_stepId: { orderId: order2Id, stepId: step3.id } },
    });
    rec("OSP.cycleCount = 3",
      osp3_12?.cycleCount === 3,
      `got: ${osp3_12?.cycleCount}`
    );

    const order2_12 = await (prisma as any).order.findUnique({
      where: { id: order2Id },
      select: { requiresAttention: true },
    });
    rec("Order2.requiresAttention = true",
      order2_12?.requiresAttention === true,
      `got: ${order2_12?.requiresAttention}`
    );

    const escalationNotif = await (prisma as any).notification.findFirst({
      where: { userId: owner.id, type: "escalation" },
      orderBy: { createdAt: "desc" },
    });
    rec("Escalation notification for store owner",
      !!escalationNotif,
      escalationNotif?.id?.slice(-6) ?? "none"
    );
  }

  // ── CLEANUP ───────────────────────────────────────────────────────────────
  console.log("\n[CLEANUP]");
  await cleanup({
    customer, owner, delivery, thirdparty,
    store, ownerPage, delivPage, thirdPage, initiative,
    orderIds: [orderId, order2Id].filter(Boolean),
    delivery2: delivery2 ?? null,
    delivPage2: delivPage2 ?? null,
  });
  console.log("  Cleanup complete.");

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("  SUMMARY");
  console.log("=".repeat(60));

  const testGroups = [
    { label: "Test 1 — Place order",                         keys: ["Place Order"] },
    { label: "Test 2 — Confirm order + workflow activate",   keys: ["3 OSP rows created", "Step 1 OSP active", "Order.assignedToId = delivCollab"] },
    { label: "Test 3 — Confirm step 1",                      keys: ["HTTP confirm step 1", "Step 1 OSP confirmed", "Step 2 OSP active", "Quote rows created for thirdparty"] },
    { label: "Test 4 — Submit quote",                        keys: ["HTTP respond to quote", "Quote status = submitted", "Quote amount = 150", "Order.quoteSummary set"] },
    { label: "Test 5 — Accept quote",                        keys: ["HTTP accept quote", "Quote status = accepted", "Step 2 OSP confirmed", "Step 3 OSP active", "Order.assignedToId = delivCollab (step 3 activated)", "Order.deliveryStatus = out_for_delivery"] },
    { label: "Test 6 — Delivery partner confirms",           keys: ["HTTP confirm step 3 (delivery)", "Step 3 OSP confirmed", "Order.deliveryStatus still out_for_delivery"] },
    { label: "Test 7 — Customer confirms receipt",           keys: ["HTTP customer-confirm", "Order.deliveryStatus = delivered", "Order.partnerStatus = completed"] },
    { label: "Group 8 — WorkflowStepAssignee setup",         keys: ["delivery2 user created", "delivPage2 page created", "newCollab created", "WorkflowStepAssignee rows created for step3", "step3.assignmentMode = sequential"] },
    { label: "Group 9 — First partner assignment",           keys: ["Order2 placed", "Order2 step1 confirmed", "Order2 step2 confirmed", "Order2 step3 OSP active", "OSP.currentAssigneeId = stepAssignee1", "Order2.assignedToId = delivCollab", "Order2.agreedAmount = 50", "Order2.partnerStatus = assigned", "Sub-order exists for delivery user", "Notification exists for delivery user"] },
    { label: "Part 4 — GPS simulation",                      keys: ["Vehicle created in DB", "delivery1 accepted order2", "Order2 vehicleId patched", "Vehicle coords updated in DB", "GET vehicles returns vehicle", "Vehicle lat updated to 22.5730", "Vehicle lng updated to 88.3645"] },
    { label: "Group 10 — Rejection to delivery2",            keys: ["delivery1 rejected order2", "OSP.currentAssigneeId = stepAssignee2", "Order2.assignedToId = newCollab", "Order2.agreedAmount = 60", "Order2.partnerStatus = assigned (delivery2)", "Notification exists for delivery2"] },
    { label: "Group 11 — 5% fee hike on cycle restart",      keys: ["delivery2 rejected order2", "OSP.cycleCount = 1", "OSP.lastFeeMultiplier = 1.05", "Order2.assignedToId = delivCollab (back to top)", "Order2.agreedAmount = 52.5"] },
    { label: "Group 12 — Escalation after 3 cycles",         keys: ["Rejection 1 (delivery1)", "Rejection 2 (delivery2)", "Rejection 3 (delivery1)", "Rejection 4 (delivery2)", "OSP.cycleCount = 3", "Order2.requiresAttention = true", "Escalation notification for store owner"] },
  ];

  let groupPass = 0;
  for (const g of testGroups) {
    const relevant = results.filter((r) => g.keys.includes(r.name));
    const allPass  = relevant.length > 0 && relevant.every((r) => r.passed);
    const icon     = allPass ? "✓" : "✗";
    console.log(`  ${icon} ${g.label}: ${allPass ? "PASS" : "FAIL"}`);
    if (!allPass) {
      relevant.filter((r) => !r.passed).forEach((r) => console.log(`      ↳ ${r.name}${r.error ? `: ${r.error}` : ""}`));
    }
    if (allPass) groupPass++;
  }

  const total     = results.length;
  const checkPass = results.filter((r) => r.passed).length;
  console.log(`\n  Checks: ${checkPass}/${total} passed`);
  console.log(`  Groups: ${groupPass}/${testGroups.length} passed`);
  console.log("=".repeat(60));

  await prisma.$disconnect();
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

async function cleanup({
  customer,
  owner,
  delivery,
  thirdparty,
  store,
  ownerPage,
  delivPage,
  thirdPage,
  initiative,
  orderIds,
  delivery2,
  delivPage2,
}: {
  customer: { id: string };
  owner: { id: string };
  delivery: { id: string };
  thirdparty: { id: string };
  store: { id: string };
  ownerPage: { id: string };
  delivPage: { id: string };
  thirdPage: { id: string };
  initiative: { id: string };
  orderIds: string[];
  delivery2?: { id: string } | null;
  delivPage2?: { id: string } | null;
}) {
  if (orderIds.length > 0) {
    // Delete sub-orders first (FK to parent order via plain string, not Prisma relation)
    await (prisma as any).order.deleteMany({
      where: { parentOrderId: { in: orderIds } },
    }).catch(() => {});

    await prisma.quote.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderStepProgress.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  }

  await prisma.workflowStep.deleteMany({ where: { initiativeId: initiative.id } });

  // Delete any test vehicles
  await prisma.vehicle.deleteMany({ where: { id: { startsWith: "test-" } } }).catch(() => {});

  // ChatMessages/Conversations created by triggerQuoteRequests for our test users
  const allTestUserIds = [owner.id, customer.id, delivery.id, thirdparty.id];
  if (delivery2) allTestUserIds.push(delivery2.id);

  const convs = await prisma.chatConversation.findMany({
    where: { OR: [{ userAId: { in: allTestUserIds } }, { userBId: { in: allTestUserIds } }] },
    select: { id: true, userAId: true, userBId: true },
  });
  const testUserSet = new Set(allTestUserIds);
  const testConvIds = convs.filter((c) => testUserSet.has(c.userAId) && testUserSet.has(c.userBId)).map((c) => c.id);
  if (testConvIds.length > 0) {
    await prisma.chatMessage.deleteMany({ where: { conversationId: { in: testConvIds } } });
    await prisma.chatConversation.deleteMany({ where: { id: { in: testConvIds } } });
  }

  await prisma.address.deleteMany({ where: { userId: customer.id } });

  // Collaborations cascade-delete when pages are deleted
  // Store must be deleted before owner page
  await prisma.store.delete({ where: { id: store.id } }).catch(() => {});

  // Pages — cascade deletes collaborations and WorkflowStepAssignees (via step cascade)
  const pagesToDelete = [ownerPage.id, delivPage.id, thirdPage.id, initiative.id];
  if (delivPage2) pagesToDelete.push(delivPage2.id);
  for (const pid of pagesToDelete) {
    await prisma.page.delete({ where: { id: pid } }).catch(() => {});
  }

  const usersToDelete = [customer.id, owner.id, delivery.id, thirdparty.id];
  if (delivery2) usersToDelete.push(delivery2.id);
  for (const uid of usersToDelete) {
    await prisma.user.delete({ where: { id: uid } }).catch(() => {});
  }
}

main().catch((e) => {
  console.error("\n[FATAL]", e);
  prisma.$disconnect();
  process.exit(1);
});
