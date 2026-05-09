import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import sendEmail from "@/lib/email";

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeId, addressId } = await req.json();
  if (!storeId || !addressId)
    return NextResponse.json({ error: "storeId and addressId required" }, { status: 400 });

  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address || address.userId !== user.id)
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: user.id, storeId },
    include: {
      block: { select: { id: true, title: true, price: true, mediaUrl: true } },
    },
  });

  if (cartItems.length === 0)
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });

  const items = cartItems.map((ci) => ({
    blockId: ci.blockId,
    title: ci.block.title,
    price: ci.block.price ?? 0,
    quantity: ci.quantity,
    imageUrl: ci.block.mediaUrl ?? null,
  }));

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const order = await prisma.order.create({
    data: { userId: user.id, storeId, addressId, status: "pending", total, items },
    include: { store: true, address: true },
  });

  await prisma.cartItem.deleteMany({ where: { userId: user.id, storeId } });

  // Send email to store owner
  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { owner: { select: { email: true, name: true } } },
    });

    if (store?.owner?.email) {
      const itemLines = items
        .map((i) => `• ${i.title} × ${i.quantity} — ₹${(i.price * i.quantity).toLocaleString("en-IN")}`)
        .join("\n");

      const addressLine = `${address.name}\n${address.line1}\n${address.city}, ${address.state} — ${address.pincode}\nPhone: ${address.phone}`;

      await sendEmail({
        to: store.owner.email,
        subject: `New Order on ${store.name} — #${order.id.slice(-8).toUpperCase()}`,
        text: `Hi ${store.owner.name ?? "there"},

You have a new Cash on Delivery order on ${store.name}!

Order ID: #${order.id.slice(-8).toUpperCase()}
Customer: ${user.name ?? user.email ?? "Customer"}

Items:
${itemLines}

Total: ₹${total.toLocaleString("en-IN")}

Delivery Address:
${addressLine}

Payment: Cash on Delivery

Log in to manage this order:
https://charaivati.com/self?tab=earn
`,
        html: `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="color:#6366f1">New Order on ${store.name}!</h2>
  <p>Hi ${store.owner.name ?? "there"},</p>
  <p>You have a new <strong>Cash on Delivery</strong> order.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr style="background:#f3f4f6">
      <td style="padding:8px;font-size:12px;color:#6b7280">ORDER ID</td>
      <td style="padding:8px;font-weight:600">#${order.id.slice(-8).toUpperCase()}</td>
    </tr>
    <tr>
      <td style="padding:8px;font-size:12px;color:#6b7280">CUSTOMER</td>
      <td style="padding:8px">${user.name ?? user.email ?? "Customer"}</td>
    </tr>
    <tr style="background:#f3f4f6">
      <td style="padding:8px;font-size:12px;color:#6b7280">TOTAL</td>
      <td style="padding:8px;font-weight:600">₹${total.toLocaleString("en-IN")}</td>
    </tr>
    <tr>
      <td style="padding:8px;font-size:12px;color:#6b7280">PAYMENT</td>
      <td style="padding:8px">Cash on Delivery</td>
    </tr>
  </table>
  <h3 style="margin-top:24px">Items</h3>
  <table style="width:100%;border-collapse:collapse">
    ${items.map((i) => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:8px">${i.title}</td>
      <td style="padding:8px;text-align:center;color:#6b7280">×${i.quantity}</td>
      <td style="padding:8px;text-align:right;font-weight:600">₹${(i.price * i.quantity).toLocaleString("en-IN")}</td>
    </tr>`).join("")}
  </table>
  <h3 style="margin-top:24px">Delivery Address</h3>
  <div style="background:#f9fafb;padding:12px;border-radius:8px;font-size:14px">
    <strong>${address.name}</strong><br/>
    ${address.line1}<br/>
    ${address.city}, ${address.state} — ${address.pincode}<br/>
    📞 ${address.phone}
  </div>
  <div style="margin-top:24px;text-align:center">
    <a href="https://charaivati.com/self?tab=earn"
      style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
      View Orders
    </a>
  </div>
</div>`,
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
    if (!store || store.ownerId !== user.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
