import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

type Params = { params: Promise<{ id: string; stepId: string }> };

// PATCH — retry a failed workflow step (owner only)
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: orderId, stepId } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      assignedToId: true,
      store: { select: { ownerId: true } },
    },
  });
  if (!order || order.store.ownerId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const step = await prisma.workflowStep.findUnique({
    where: { id: stepId },
    select: { id: true },
  });
  if (!step) return NextResponse.json({ error: "Step not found" }, { status: 404 });

  const body = await req.json() as { assigneeId?: string };

  // Reset the failed OSP back to active
  await prisma.orderStepProgress.updateMany({
    where: { orderId, stepId, status: "failed" },
    data:  { status: "active", activatedAt: new Date() },
  });

  // Build order patch
  const orderPatch: Record<string, unknown> = { requiresAttention: false };

  if (body.assigneeId) {
    // Reassign to a new partner
    orderPatch.assignedToId = body.assigneeId;
    orderPatch.partnerStatus = "assigned";
  } else if (order.assignedToId) {
    // Re-notify the existing partner
    orderPatch.partnerStatus = "assigned";
  }
  // If no assignee at all: just clear requiresAttention; owner must assign manually

  await prisma.order.update({ where: { id: orderId }, data: orderPatch });

  return NextResponse.json({ ok: true });
}
