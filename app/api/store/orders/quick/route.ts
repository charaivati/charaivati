import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import getServerUser from "@/lib/serverAuth";

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

  const { storeId, addressId, items, billingProfileId } = await req.json();

  if (!storeId || !addressId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "storeId, addressId, and items are required" }, { status: 400 });
  }

  const address = await db.address.findUnique({ where: { id: addressId } });
  if (!address || address.userId !== user.id) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const store = await db.store.findUnique({ where: { id: storeId } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const orderItems: QuickItem[] = items.map((i: QuickItem) => ({
    blockId: i.blockId,
    title: i.title,
    price: i.price ?? 0,
    quantity: i.quantity ?? 1,
    imageUrl: i.imageUrl ?? null,
  }));

  const total = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);

  const orderData: Record<string, unknown> = {
    userId: user.id,
    storeId,
    addressId,
    status: "pending",
    total,
    items: orderItems,
  };

  if (billingProfileId) {
    const bp = await db.billingProfile.findUnique({ where: { id: billingProfileId } });
    if (bp && bp.userId === user.id) {
      (orderData as any).billingProfileId = billingProfileId;
    }
  }

  const order = await db.order.create({
    data: orderData as any,
    include: { store: true, address: true },
  });

  try {
    const storeWithOwner = await db.store.findUnique({
      where: { id: storeId },
      include: { owner: { select: { email: true, name: true } } },
    });

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

  return NextResponse.json(order, { status: 201 });
}
