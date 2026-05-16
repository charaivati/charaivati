import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { getStoreSlugs } from "@/lib/store/getStoreSlugs";

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

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

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

  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { owner: { select: { email: true, name: true } } },
    });

    if (store?.owner?.email) {
      const itemLines = items.map((i) => `  - ${i.title} x${i.quantity} @ ₹${i.price}`).join("\n");
      const addressLine = `${address.name}, ${address.line1}, ${address.city}, ${address.state} - ${address.pincode} | Phone: ${address.phone}`;

      await sendOrderEmail({
        to: store.owner.email,
        ownerName: store.owner.name ?? "Store Owner",
        storeName: store.name,
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
    const signedRowsAll = await prisma.$queryRaw<{ id: string; "invoiceSignedUrl": string | null }[]>`
      SELECT id, "invoiceSignedUrl" FROM "Order" WHERE "storeId" = ANY(${storeIds}::text[])
    `;
    const signedMapAll: Record<string, string | null> = {};
    for (const r of signedRowsAll) signedMapAll[r.id] = r["invoiceSignedUrl"] ?? null;
    return NextResponse.json(
      orders.map((o) => ({ ...o, store: { ...o.store, slug: slugs[o.store.id] ?? null }, invoiceSignedUrl: signedMapAll[o.id] ?? null }))
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
    return NextResponse.json(orders.map((o) => ({ ...o, invoiceSignedUrl: signedMapStore[o.id] ?? null })));
  }

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: { store: { select: { id: true, name: true } }, address: true },
    orderBy: { createdAt: "desc" },
  });
  const buyerStoreIds = [...new Set(orders.map((o) => o.storeId))];
  const slugs = await getStoreSlugs(buyerStoreIds);

  // Fetch signed invoice URLs via raw SQL (new columns may not be in stale client)
  const signedRows = await prisma.$queryRaw<{ id: string; "invoiceSignedUrl": string | null }[]>`
    SELECT id, "invoiceSignedUrl" FROM "Order" WHERE "userId" = ${user.id}
  `;
  const signedMap: Record<string, string | null> = {};
  for (const r of signedRows) signedMap[r.id] = r["invoiceSignedUrl"] ?? null;

  return NextResponse.json(
    orders.map((o) => ({
      ...o,
      store: o.store ? { ...o.store, slug: slugs[o.store.id] ?? null } : o.store,
      invoiceSignedUrl: signedMap[o.id] ?? null,
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
