import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { activateWorkflow } from "@/lib/workflow/activateWorkflow";
import { createNotification } from "@/lib/notifications/createNotification";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.$queryRaw`
    SELECT
      o.id, o.status, o.total, o."createdAt", o.items,
      o."deliveryStatus", o."partnerStatus", o."assignedToId",
      o."deliveryNote", o."invoiceUrl", o."invoiceSignedUrl",
      o."userId",
      s.id AS "storeId", s.name AS "storeName", s."ownerId", s.slug AS "storeSlug",
      u.name AS "userName", u.email AS "userEmail",
      a.name AS "addrName", a.phone AS "addrPhone",
      a."line1" AS "addrLine1", a.city AS "addrCity",
      a.state AS "addrState", a.pincode AS "addrPincode"
    FROM "Order" o
    JOIN "Store" s ON s.id = o."storeId"
    LEFT JOIN "User" u ON u.id = o."userId"
    LEFT JOIN "Address" a ON a.id = o."addressId"
    WHERE o.id = ${orderId}
    LIMIT 1
  `;

  const row = (rows as any[])[0];
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (row.ownerId !== user.id && row.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: row.id,
    status: row.status,
    total: Number(row.total),
    createdAt: row.createdAt,
    items: row.items ?? [],
    deliveryStatus: row.deliveryStatus ?? null,
    partnerStatus: row.partnerStatus ?? null,
    assignedToId: row.assignedToId ?? null,
    deliveryNote: row.deliveryNote ?? null,
    invoiceUrl: row.invoiceUrl ?? null,
    invoiceSignedUrl: row.invoiceSignedUrl ?? null,
    store: { id: row.storeId, name: row.storeName, slug: row.storeSlug ?? null },
    user: { name: row.userName ?? null, email: row.userEmail ?? null },
    address: row.addrLine1
      ? {
          name: row.addrName ?? "",
          phone: row.addrPhone ?? "",
          line1: row.addrLine1,
          city: row.addrCity ?? "",
          state: row.addrState ?? "",
          pincode: row.addrPincode ?? "",
        }
      : null,
    isOwner: row.ownerId === user.id,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status } = await req.json();
  const allowed = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
  if (!allowed.includes(status))
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { store: true, user: { select: { id: true, status: true } } },
  });

  if (!order || order.store.ownerId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status },
  });

  if (status === "confirmed") {
    // Activate workflow steps
    activateWorkflow(orderId).catch((e) =>
      console.error("activateWorkflow error:", e)
    );
    // Notify the store owner that the order has been confirmed
    createNotification({
      userId: user.id,
      type: "order_confirmed",
      title: "Order confirmed",
      body: `Order #${orderId.slice(-8).toUpperCase()} confirmed.`,
      link: "/store/orders/all",
    }).catch(() => {});
    // Notify the buyer their order was confirmed
    if (order.userId && order.user?.status !== "guest") {
      createNotification({
        userId: order.userId,
        type: "order_confirmed",
        title: "Order confirmed",
        body: `Your order from ${order.store.name} has been confirmed and is being prepared.`,
        link: `/app/orders`,
      }).catch(() => {});
    }
  }

  if (status === "cancelled") {
    // Notify the buyer their order was cancelled
    if (order.userId && order.user?.status !== "guest") {
      createNotification({
        userId: order.userId,
        type: "order_cancelled",
        title: "Order cancelled",
        body: `Your order from ${order.store.name} has been cancelled.`,
        link: `/app/orders`,
      }).catch(() => {});
    }
  }

  return NextResponse.json(updated);
}
