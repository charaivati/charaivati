import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import getServerUser from "@/lib/serverAuth";
import { createNotification } from "@/lib/notifications/createNotification";

type QuickItem = {
  blockId: string;
  title: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
};

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeId, addressId, items, billingProfileId, invoiceData } = await req.json();

  if (!storeId || !addressId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "storeId, addressId, and items are required" }, { status: 400 });
  }

  const address = await db.address.findUnique({ where: { id: addressId } });
  if (!address || address.userId !== user.id) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const store = await db.store.findUnique({ where: { id: storeId } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });
  const storeStatusRow = await db.$queryRaw<{ acceptingOrders: boolean; deletedAt: Date | null }[]>`
    SELECT "acceptingOrders", "deletedAt" FROM "Store" WHERE id = ${storeId} LIMIT 1
  `;
  if (!storeStatusRow[0] || storeStatusRow[0].deletedAt) {
    return NextResponse.json({ error: "This store is no longer accepting orders." }, { status: 422 });
  }
  if (!storeStatusRow[0].acceptingOrders) {
    return NextResponse.json({ error: "This store isn't taking orders right now." }, { status: 422 });
  }

  const orderItems: QuickItem[] = items.map((i: QuickItem) => ({
    blockId: i.blockId,
    title: i.title,
    price: i.price ?? 0,
    quantity: i.quantity ?? 1,
    imageUrl: i.imageUrl ?? null,
  }));

  const itemsTotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const fee = (store as any).deliveryFee ?? null;
  const freeAbove = (store as any).freeDeliveryAbove ?? null;
  const deliveryFeeApplied = fee != null && (freeAbove == null || itemsTotal < freeAbove) ? fee : 0;
  const total = itemsTotal + deliveryFeeApplied;

  const orderData: Record<string, unknown> = {
    userId: user.id,
    storeId,
    addressId,
    status: "pending",
    total,
    items: orderItems,
  };

  // Resolve invoice data — either inline (from QuickOrderModal personal profile)
  // or expanded from a saved BillingProfile. Order has no billingProfileId column.
  if (invoiceData && typeof invoiceData === "object") {
    orderData.invoiceData = invoiceData;
  } else if (billingProfileId) {
    const bp = await (db.billingProfile as any).findUnique({ where: { id: billingProfileId } });
    if (bp && bp.userId === user.id) {
      orderData.invoiceData = {
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

  const order = await db.order.create({
    data: orderData as any,
    include: { store: true, address: true },
  });

  const storeWithOwner = await db.store.findUnique({
    where: { id: storeId },
    include: { owner: { select: { email: true, name: true } } },
  }).catch(() => null);

  try {
    if (storeWithOwner?.owner?.email) {
      const { sendEmail } = await import("@/lib/sendEmail");
      const itemLines = orderItems.map((i) => `  - ${i.title} x${i.quantity} @ ₹${i.price}`).join("\n");
      const addressLine = `${address.name}, ${address.line1}, ${address.city}, ${address.state} - ${address.pincode} | Phone: ${address.phone}`;
      await sendEmail({
        to: storeWithOwner.owner.email,
        subject: `New Order on ${store.name} — #${order.id.slice(-8).toUpperCase()}`,
        text: `Hi ${storeWithOwner.owner.name ?? "Store Owner"},\n\nNew order on ${store.name}!\n\nOrder ID: #${order.id.slice(-8).toUpperCase()}\nCustomer: ${user.name ?? "Customer"}\n\nItems:\n${itemLines}\n\nTotal: ₹${total.toLocaleString("en-IN")}\n\nDelivery Address:\n${addressLine}\n\nPayment: Cash on Delivery`.trim(),
      });
    }
  } catch (e) {
    console.error("Quick order email failed:", e);
  }

  try {
    if (storeWithOwner) {
      await createNotification({
        userId: storeWithOwner.ownerId,
        type: "order_confirmed",
        title: `New order on ${storeWithOwner.name}`,
        body: `Order #${order.id.slice(-8).toUpperCase()} — ₹${total.toLocaleString("en-IN")}`,
        link: `/store/${storeId}/orders`,
      });
    }
  } catch (e) {
    console.error("Notification failed:", e);
  }

  return NextResponse.json(order, { status: 201 });
}
