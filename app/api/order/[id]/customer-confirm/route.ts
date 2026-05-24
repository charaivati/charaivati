import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { advanceToNextStep } from "@/lib/workflow/advanceToNextStep";
import { createNotification } from "@/lib/notifications/createNotification";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id: orderId } = await params;
  let user = await getServerUser(req);
  // TEST ONLY — never deploy with ALLOW_TEST_BYPASS=true
  if (!user && process.env.ALLOW_TEST_BYPASS === "true") {
    const tid = req.headers.get("x-test-userid");
    if (tid) user = await prisma.user.findUnique({ where: { id: tid }, select: { id: true, email: true, name: true } });
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await (prisma as any).order.findUnique({
    where: { id: orderId },
    select: {
      userId: true,
      deliveryStatus: true,
      parentOrderId: true,
      storeId: true,
      store: { select: { ownerId: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.userId !== user.id)
    return NextResponse.json({ error: "Forbidden — buyer only" }, { status: 403 });

  // Idempotent — safe to call twice
  if (order.deliveryStatus === "delivered")
    return NextResponse.json({ ok: true, already: true });

  await prisma.order.update({
    where: { id: orderId },
    data: { deliveryStatus: "delivered", partnerStatus: "completed" },
  });

  // Notify the store owner that the customer confirmed receipt
  const storeOwnerId = order.store?.ownerId;
  if (storeOwnerId) {
    createNotification({
      userId: storeOwnerId,
      type: "delivery_complete",
      title: "Order delivered",
      body: `Customer confirmed receipt of Order #${orderId.slice(-8).toUpperCase()}`,
      link: order.storeId ? `/store/${order.storeId}/orders/delivered` : "/store/orders/all",
    }).catch(() => {});
  }

  // Give Neon DB time to fully commit before responding
  await new Promise((r) => setTimeout(r, 500));

  // If this is a sub-order, advance the parent order's workflow
  if (order.parentOrderId) {
    const activeOSP = await prisma.orderStepProgress.findFirst({
      where:   { orderId: order.parentOrderId, status: "active" },
      select:  { id: true, stepId: true },
      orderBy: { activatedAt: "desc" },
    });
    if (activeOSP) {
      await prisma.orderStepProgress.update({
        where: { id: activeOSP.id },
        data:  { status: "confirmed", confirmedAt: new Date() },
      });
      // Fire-and-forget so it does not delay the response
      advanceToNextStep(order.parentOrderId, activeOSP.stepId).catch((e) =>
        console.error("customer-confirm: advanceToNextStep failed:", e)
      );
    }
  }

  return NextResponse.json({ ok: true });
}
