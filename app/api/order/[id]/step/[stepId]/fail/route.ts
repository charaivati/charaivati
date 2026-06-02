import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

type Params = { params: Promise<{ id: string; stepId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: orderId, stepId } = await params;
  let user = await getServerUser(req);
  // TEST ONLY — never deploy with ALLOW_TEST_BYPASS=true
  if (!user && process.env.ALLOW_TEST_BYPASS === "true") {
    const tid = req.headers.get("x-test-userid");
    if (tid) user = await prisma.user.findUnique({ where: { id: tid }, select: { id: true, email: true, name: true } });
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { store: { select: { ownerId: true, pageId: true } } },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const step = await prisma.workflowStep.findUnique({
    where: { id: stepId },
    select: { assigneeId: true },
  });
  if (!step) return NextResponse.json({ error: "Step not found" }, { status: 404 });

  const isOwner = order.store.ownerId === user.id;

  let isAssignee = false;
  if (step.assigneeId) {
    const collab = await prisma.collaboration.findUnique({
      where: { id: step.assigneeId },
      include: {
        requester:    { select: { ownerId: true } },
        receiverPage: { select: { ownerId: true } },
      },
    });
    if (collab) {
      const storePageId = order.store.pageId;
      const partnerPage =
        storePageId && collab.requesterId === storePageId ? collab.receiverPage : collab.requester;
      isAssignee = partnerPage?.ownerId === user.id;
    }
  }

  if (!isOwner && !isAssignee)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Mark step failed and cancel order, flag for owner attention
  await Promise.all([
    prisma.orderStepProgress.updateMany({
      where: { orderId, stepId },
      data:  { status: "failed" },
    }),
    prisma.order.update({
      where: { id: orderId },
      data:  { deliveryStatus: "cancelled", requiresAttention: true },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
