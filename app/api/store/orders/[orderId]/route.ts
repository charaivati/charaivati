import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { activateWorkflow } from "@/lib/workflow/activateWorkflow";
import { createNotification } from "@/lib/notifications/createNotification";

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
      title: "New order received",
      body: `Order #${orderId.slice(-8).toUpperCase()} has been placed`,
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
