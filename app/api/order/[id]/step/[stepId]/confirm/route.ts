import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { advanceToNextStep } from "@/lib/workflow/advanceToNextStep";
import { assignNextPartner } from "@/lib/workflow/assignNextPartner";
import { createNotification } from "@/lib/notifications/createNotification";

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
    select: { store: { select: { ownerId: true, pageId: true, deletedAt: true } } },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Zombie-prevention guard: a deleted store can have no further workflow actions.
  if (order.store.deletedAt) {
    return NextResponse.json({ error: "This store has been deleted — no further actions are possible." }, { status: 409 });
  }

  const step = await prisma.workflowStep.findUnique({
    where: { id: stepId },
    select: { id: true, assigneeId: true, initiativeId: true },
  });
  if (!step) return NextResponse.json({ error: "Step not found" }, { status: 404 });

  // Fetch activityType via raw SQL — new column not in stale Prisma client
  const activityRaw = await prisma.$queryRaw<{ activityType: string }[]>`
    SELECT "activityType" FROM "WorkflowStep" WHERE id = ${stepId}
  `;
  const activityType = activityRaw[0]?.activityType ?? "normal";

  const isOwner = order.store.ownerId === user.id;

  // Auth: WorkflowStepAssignee rows are the primary check (new system)
  let isAssignee = false;
  const wsaRows = await (prisma as any).workflowStepAssignee.findMany({
    where: { stepId },
    select: { collaborationId: true },
  }) as { collaborationId: string }[];

  if (wsaRows.length > 0) {
    const collabIds = wsaRows.map((r: { collaborationId: string }) => r.collaborationId);
    const wsaCollabs = await prisma.collaboration.findMany({
      where: { id: { in: collabIds } },
      include: {
        requester:    { select: { ownerId: true } },
        receiverPage: { select: { ownerId: true } },
      },
    });
    const storePageId = order.store.pageId;
    for (const collab of wsaCollabs) {
      if ((collab as any).receiverUserId === user.id) {
        isAssignee = true;
        break;
      }
      const partnerPage =
        storePageId && collab.requesterId === storePageId ? collab.receiverPage : collab.requester;
      if (partnerPage?.ownerId === user.id) {
        isAssignee = true;
        break;
      }
    }
  }

  // Fallback: deprecated scalar assigneeId
  if (!isOwner && !isAssignee && step.assigneeId) {
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

  // Delivery steps can only be confirmed by the store owner (dispatch hasn't happened yet)
  const authorizedToConfirm = activityType === "delivery" ? isOwner : (isOwner || isAssignee);
  if (!authorizedToConfirm)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Verify the OSP row is active before confirming
  const osp = await prisma.orderStepProgress.findUnique({
    where: { orderId_stepId: { orderId, stepId } },
    select: { id: true, status: true },
  });
  if (!osp) return NextResponse.json({ error: "Step progress not found" }, { status: 404 });
  if (osp.status !== "active")
    return NextResponse.json({ error: `Step is '${osp.status}', not active` }, { status: 400 });

  // Confirm this step
  await prisma.orderStepProgress.update({
    where: { orderId_stepId: { orderId, stepId } },
    data: { status: "confirmed", confirmedAt: new Date() },
  });

  if (activityType === "delivery") {
    // Delivery dispatch: set deliveryStatus and cycle through assignees to find a partner
    await prisma.order.update({
      where: { id: orderId },
      data: { deliveryStatus: "out_for_delivery" },
    });

    // Reset cycling state so assignNextPartner starts from the top of the list
    await (prisma as any).orderStepProgress.update({
      where: { id: osp.id },
      data: { currentAssigneeId: null, cycleCount: 0, lastFeeMultiplier: 1.0 },
    });

    await assignNextPartner({ orderId, stepId, ospId: osp.id });
  } else {
    // Normal step: advance workflow to next step
    await advanceToNextStep(orderId, stepId);
  }

  // Notify the store owner so their order pages auto-refresh via SSE.
  // Skip when the owner confirmed themselves — they already see the result.
  const ownerId = order.store.ownerId;
  if (user.id !== ownerId) {
    createNotification({
      userId: ownerId,
      type: "step_confirmed",
      title: "Step completed",
      body: `Order #${orderId.slice(-8).toUpperCase()} — a step was confirmed.`,
      link: `/store/orders/all`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
