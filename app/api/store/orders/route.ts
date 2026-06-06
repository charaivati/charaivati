import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { getStoreSlugs } from "@/lib/store/getStoreSlugs";
import { createNotification } from "@/lib/notifications/createNotification";

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeId, addressId, billingProfileId, invoiceData } = await req.json();
  if (!storeId || !addressId) {
    return NextResponse.json({ error: "storeId and addressId required" }, { status: 400 });
  }

  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address || address.userId !== user.id) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: user.id, storeId },
    include: {
      block: {
        select: { id: true, title: true, price: true, mediaUrl: true },
      },
    },
  });

  if (cartItems.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const items = cartItems.map((ci) => ({
    blockId: ci.blockId,
    title: ci.block.title,
    price: ci.block.price ?? 0,
    quantity: ci.quantity,
    imageUrl: ci.block.mediaUrl ?? null,
  }));

  const itemsTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartStoreRow = await prisma.$queryRaw<{ deliveryFee: number | null; freeDeliveryAbove: number | null; acceptingOrders: boolean }[]>`
    SELECT "deliveryFee", "freeDeliveryAbove", "acceptingOrders" FROM "Store" WHERE id = ${storeId} LIMIT 1
  `;
  if (!cartStoreRow[0] || !cartStoreRow[0].acceptingOrders) {
    return NextResponse.json({ error: "This store isn't taking orders right now." }, { status: 422 });
  }
  const cartFee = cartStoreRow[0]?.deliveryFee ?? null;
  const cartFreeAbove = cartStoreRow[0]?.freeDeliveryAbove ?? null;
  const cartDeliveryFee = cartFee != null && (cartFreeAbove == null || itemsTotal < cartFreeAbove) ? cartFee : 0;
  const total = itemsTotal + cartDeliveryFee;

  const invoicePayload: Record<string, unknown> = {};
  if (invoiceData && typeof invoiceData === "object") {
    invoicePayload.invoiceData = invoiceData;
  } else if (billingProfileId) {
    const bp = await (prisma.billingProfile as any).findUnique({ where: { id: billingProfileId } });
    if (bp && bp.userId === user.id) {
      invoicePayload.invoiceData = {
        legalName: bp.legalName,
        companyName: bp.companyName ?? null,
        gstin: bp.gstin ?? null,
        gstState: bp.gstState ?? null,
        annualTurnover: bp.annualTurnover ?? null,
        addressLine: bp.addressLine ?? null,
        city: bp.city ?? null,
        state: bp.state ?? null,
        pinCode: bp.pinCode ?? null,
      };
    }
  }

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      storeId,
      addressId,
      status: "pending",
      total,
      items,
      ...invoicePayload,
    } as any,
    include: { store: true, address: true },
  });

  await prisma.cartItem.deleteMany({ where: { userId: user.id, storeId } });

  const storeForNotif = await prisma.store.findUnique({
    where: { id: storeId },
    include: { owner: { select: { email: true, name: true } } },
  }).catch(() => null);

  try {
    if (storeForNotif?.owner?.email) {
      const itemLines = items.map((i) => `  - ${i.title} x${i.quantity} @ ₹${i.price}`).join("\n");
      const addressLine = `${address.name}, ${address.line1}, ${address.city}, ${address.state} - ${address.pincode} | Phone: ${address.phone}`;

      await sendOrderEmail({
        to: storeForNotif.owner.email,
        ownerName: storeForNotif.owner.name ?? "Store Owner",
        storeName: storeForNotif.name,
        orderId: order.id,
        customerName: user.name ?? "Customer",
        itemLines,
        total,
        addressLine,
      });
    }
  } catch (e) {
    console.error("Order email failed:", e);
  }

  try {
    if (storeForNotif) {
      await createNotification({
        userId: storeForNotif.ownerId,
        type: "order_confirmed",
        title: `New order on ${storeForNotif.name}`,
        body: `Order #${order.id.slice(-8).toUpperCase()} — ₹${total.toLocaleString("en-IN")}`,
        link: `/store/${storeId}/orders`,
      });
    }
  } catch (e) {
    console.error("Notification failed:", e);
  }

  return NextResponse.json(order, { status: 201 });
}

export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let storeId = searchParams.get("storeId");
  const all = searchParams.get("all");
  const statusFilter = searchParams.get("status");

  if (all === "true") {
    const stores = await prisma.store.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    });
    const storeIds = stores.map((s) => s.id);
    const orders = await prisma.order.findMany({
      where: { storeId: { in: storeIds } },
      include: {
        store: { select: { id: true, name: true } },
        address: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const slugs = await getStoreSlugs(storeIds);
    const allOrderIds = orders.map((o) => o.id);
    const signedRowsAll = await prisma.$queryRaw<{ id: string; "invoiceSignedUrl": string | null }[]>`
      SELECT id, "invoiceSignedUrl" FROM "Order" WHERE "storeId" = ANY(${storeIds}::text[])
    `;
    const signedMapAll: Record<string, string | null> = {};
    for (const r of signedRowsAll) signedMapAll[r.id] = r["invoiceSignedUrl"] ?? null;

    // Workflow enrichment for all-orders summary view
    const wfRowsAll = allOrderIds.length > 0 ? await prisma.$queryRaw<
      { id: string; requiresAttention: boolean }[]
    >`SELECT id, "requiresAttention" FROM "Order" WHERE id = ANY(${allOrderIds}::text[])` : [];
    const wfMapAll: Record<string, boolean> = {};
    for (const r of wfRowsAll) wfMapAll[r.id] = r.requiresAttention;

    const activeOSPsAll = allOrderIds.length > 0 ? await prisma.orderStepProgress.findMany({
      where: { orderId: { in: allOrderIds }, status: "active" },
      include: { step: { select: { name: true } } },
    }) : [];
    const activeStepMapAll = new Map(activeOSPsAll.map((osp) => [osp.orderId, osp.step.name]));

    return NextResponse.json(
      orders.map((o) => ({
        ...o,
        store:             { ...o.store, slug: slugs[o.store.id] ?? null },
        invoiceSignedUrl:  signedMapAll[o.id] ?? null,
        requiresAttention: wfMapAll[o.id] ?? false,
        activeStep:        activeStepMapAll.has(o.id) ? { stepName: activeStepMapAll.get(o.id) } : null,
      }))
    );
  }

  if (storeId) {
    // Resolve slug → real cuid without relying on Prisma client knowing about slug
    const isCuid = /^c[a-z0-9]{24}$/i.test(storeId);
    if (!isCuid) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Store" WHERE slug = ${storeId} LIMIT 1
      `;
      storeId = rows[0]?.id ?? storeId;
    }
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    storeId = store.id;

    const where: { storeId: string; status?: string } = { storeId };
    if (statusFilter) where.status = statusFilter;

    const orders = await prisma.order.findMany({
      where,
      include: { address: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    const signedRowsStore = await prisma.$queryRaw<{ id: string; "invoiceSignedUrl": string | null }[]>`
      SELECT id, "invoiceSignedUrl" FROM "Order" WHERE "storeId" = ${storeId}
    `;
    const signedMapStore: Record<string, string | null> = {};
    for (const r of signedRowsStore) signedMapStore[r.id] = r["invoiceSignedUrl"] ?? null;

    // ── Workflow enrichment ──────────────────────────────────────────────────
    const orderIds = orders.map((o) => o.id);
    const storePageId = store.pageId ?? null;

    // All step progress rows (needed for fast-track queue + active step display)
    const allOSPs = orderIds.length > 0 ? await prisma.orderStepProgress.findMany({
      where: { orderId: { in: orderIds } },
      include: { step: { select: { id: true, name: true, assigneeId: true, quoteRequired: true, sequence: true } } },
    }) : [];
    const activeOSPs    = allOSPs.filter((osp) => osp.status === "active");
    const ospByOrder    = new Map(activeOSPs.map((osp) => [osp.orderId, osp]));
    const allOSPsByOrder = new Map<string, typeof allOSPs>();
    for (const osp of allOSPs) {
      if (!allOSPsByOrder.has(osp.orderId)) allOSPsByOrder.set(osp.orderId, []);
      allOSPsByOrder.get(osp.orderId)!.push(osp);
    }

    // Quotes for active steps
    const activeStepIds = activeOSPs.map((o) => o.stepId);
    const quotes = activeStepIds.length > 0 ? await prisma.quote.findMany({
      where: { orderId: { in: orderIds }, stepId: { in: activeStepIds } },
      select: { id: true, orderId: true, stepId: true, requestedPartyId: true, amount: true, status: true },
    }) : [];
    const quotesByOrder: Record<string, typeof quotes> = {};
    for (const q of quotes) {
      if (!quotesByOrder[q.orderId]) quotesByOrder[q.orderId] = [];
      quotesByOrder[q.orderId].push(q);
    }

    // Party names for assignees + quote parties
    const allCollabIds = [...new Set([
      ...activeOSPs.map((o) => o.step.assigneeId).filter(Boolean) as string[],
      ...quotes.map((q) => q.requestedPartyId),
    ])];
    const partyCodes = allCollabIds.length > 0 ? await prisma.collaboration.findMany({
      where: { id: { in: allCollabIds } },
      select: { id: true, requesterId: true, requester: { select: { title: true } }, receiverPage: { select: { title: true } } },
    }) : [];
    const partyMap = new Map(partyCodes.map((c) => [c.id, c]));

    function partyName(collabId: string): string {
      const c = partyMap.get(collabId);
      if (!c) return "Unknown";
      return storePageId && c.requesterId === storePageId ? (c.receiverPage?.title ?? "Unknown") : c.requester.title;
    }

    // activityType for all steps — new column, must use raw SQL
    const allStepIdsForActivity = [...new Set(allOSPs.map((osp) => osp.stepId))];
    const activityTypeRows = allStepIdsForActivity.length > 0
      ? await prisma.$queryRaw<{ id: string; activityType: string }[]>`
          SELECT id, "activityType" FROM "WorkflowStep" WHERE id = ANY(${allStepIdsForActivity}::text[])
        `
      : [];
    const stepActivityTypeMap = new Map(activityTypeRows.map((r) => [r.id, r.activityType]));

    // requiresAttention + quoteSummary + agreedAmount (new columns — raw SQL)
    const wfRows = orderIds.length > 0 ? await prisma.$queryRaw<
      { id: string; requiresAttention: boolean; quoteSummary: unknown; agreedAmount: number | null }[]
    >`SELECT id, "requiresAttention", "quoteSummary", "agreedAmount" FROM "Order" WHERE id = ANY(${orderIds}::text[])` : [];
    const wfMap: Record<string, { requiresAttention: boolean; quoteSummary: unknown; agreedAmount: number | null }> = {};
    for (const r of wfRows) wfMap[r.id] = { requiresAttention: r.requiresAttention, quoteSummary: r.quoteSummary, agreedAmount: r.agreedAmount ?? null };

    // Sub-orders (new columns — raw SQL)
    const subOrderRows = orderIds.length > 0 ? await prisma.$queryRaw<
      { id: string; parentOrderId: string; subOrderType: string | null; agreedAmount: number | null; userId: string }[]
    >`SELECT id, "parentOrderId", "subOrderType", "agreedAmount", "userId" FROM "Order" WHERE "parentOrderId" = ANY(${orderIds}::text[])` : [];
    const subOrdersByParent: Record<string, typeof subOrderRows> = {};
    for (const r of subOrderRows) {
      if (!subOrdersByParent[r.parentOrderId]) subOrdersByParent[r.parentOrderId] = [];
      subOrdersByParent[r.parentOrderId].push(r);
    }

    return NextResponse.json(orders.map((o) => {
      const osp = ospByOrder.get(o.id);
      // Sort quotes by amount asc (nulls last) so the cheapest option is shown first
      const orderQuotes = (quotesByOrder[o.id] ?? [])
        .slice()
        .sort((a, b) => (a.amount ?? Infinity) - (b.amount ?? Infinity));
      return {
        ...o,
        invoiceSignedUrl:  signedMapStore[o.id] ?? null,
        requiresAttention: wfMap[o.id]?.requiresAttention ?? false,
        quoteSummary:      wfMap[o.id]?.quoteSummary ?? null,
        agreedAmount:      wfMap[o.id]?.agreedAmount ?? null,
        initiativeId:      storePageId,
        activeStep: osp ? {
          stepId:        osp.stepId,
          stepName:      osp.step.name,
          assigneeName:  osp.step.assigneeId ? partyName(osp.step.assigneeId) : null,
          quoteRequired: osp.step.quoteRequired,
          activityType:  stepActivityTypeMap.get(osp.stepId) ?? "normal",
        } : null,
        quotes: orderQuotes.map((q) => ({
          id:        q.id,
          stepId:    q.stepId,
          partyName: partyName(q.requestedPartyId),
          amount:    q.amount,
          status:    q.status,
        })),
        allSteps: (allOSPsByOrder.get(o.id) ?? [])
          .sort((a, b) => a.step.sequence - b.step.sequence)
          .map((osp) => ({
            stepId:        osp.stepId,
            stepName:      osp.step.name,
            sequence:      osp.step.sequence,
            quoteRequired: osp.step.quoteRequired,
            ospStatus:     osp.status,
            activityType:  stepActivityTypeMap.get(osp.stepId) ?? "normal",
          })),
        subOrders: (subOrdersByParent[o.id] ?? []).map((s) => ({
          id:           s.id,
          subOrderType: s.subOrderType,
          agreedAmount: s.agreedAmount,
          userId:       s.userId,
        })),
      };
    }));
  }

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: { store: { select: { id: true, name: true } }, address: true },
    orderBy: { createdAt: "desc" },
  });
  const buyerStoreIds = [...new Set(orders.map((o) => o.storeId))];
  const slugs = await getStoreSlugs(buyerStoreIds);

  // Fetch new/stale-client columns via raw SQL
  const extraRows = await prisma.$queryRaw<{
    id: string;
    "invoiceSignedUrl": string | null;
    "parentOrderId": string | null;
    "subOrderType": string | null;
    "agreedAmount": number | null;
  }[]>`
    SELECT id, "invoiceSignedUrl", "parentOrderId", "subOrderType", "agreedAmount"
    FROM "Order" WHERE "userId" = ${user.id}
  `;
  const extraMap: Record<string, typeof extraRows[0]> = {};
  for (const r of extraRows) extraMap[r.id] = r;

  return NextResponse.json(
    orders.map((o) => ({
      ...o,
      store:           o.store ? { ...o.store, slug: slugs[o.store.id] ?? null } : o.store,
      invoiceSignedUrl: extraMap[o.id]?.["invoiceSignedUrl"] ?? null,
      parentOrderId:    extraMap[o.id]?.["parentOrderId"]    ?? null,
      subOrderType:     extraMap[o.id]?.["subOrderType"]     ?? null,
      agreedAmount:     extraMap[o.id]?.["agreedAmount"]     ?? null,
    }))
  );
}

async function sendOrderEmail({
  to,
  ownerName,
  storeName,
  orderId,
  customerName,
  itemLines,
  total,
  addressLine,
}: {
  to: string;
  ownerName: string;
  storeName: string;
  orderId: string;
  customerName: string;
  itemLines: string;
  total: number;
  addressLine: string;
}) {
  try {
    const { sendEmail } = await import("@/lib/sendEmail");
    await sendEmail({
      to,
      subject: `New Order on ${storeName} — #${orderId.slice(-8).toUpperCase()}`,
      text: `
Hi ${ownerName},

You have a new Cash on Delivery order on ${storeName}!

Order ID: #${orderId.slice(-8).toUpperCase()}
Customer: ${customerName}

Items:
${itemLines}

Total: ₹${total.toLocaleString("en-IN")}

Delivery Address:
${addressLine}

Payment: Cash on Delivery

Log in to Charaivati to view and manage this order.
      `.trim(),
    });
  } catch {
    console.warn("Email not sent — check lib/sendEmail.ts implementation");
  }
}
