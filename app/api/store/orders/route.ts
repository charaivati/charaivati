import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeId, addressId } = await req.json();
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

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      storeId,
      addressId,
      status: "pending",
      total,
      items,
    },
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
  const storeId = searchParams.get("storeId");

  if (storeId) {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const orders = await prisma.order.findMany({
      where: { storeId },
      include: { address: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(orders);
  }

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: { store: { select: { id: true, name: true } }, address: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders);
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
    const { sendEmail } = await import("@/lib/email");
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
    console.warn("Email not sent — check lib/email.ts implementation");
  }
}
