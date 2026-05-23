import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { advanceToNextStep } from "@/lib/workflow/advanceToNextStep";
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
    select: { store: { select: { ownerId: true, pageId: true } } },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const step = await prisma.workflowStep.findUnique({
    where: { id: stepId },
    select: { id: true, assigneeId: true, initiativeId: true },
  });
  if (!step) return NextResponse.json({ error: "Step not found" }, { status: 404 });

  const isOwner = order.store.ownerId === user.id;

  // Check if caller is the step's assignee (Collaboration partner)
  let isAssignee = false;
  if (step.assigneeId) {
    const collab = await prisma.collaboration.findUnique({
      where: { id: step.assigneeId },
      include: {
        requester: { select: { ownerId: true } },
        receiver:  { select: { ownerId: true } },
      },
    });
    if (collab) {
      const storePageId = order.store.pageId;
      const partnerPage =
        storePageId && collab.requesterId === storePageId ? collab.receiver : collab.requester;
      isAssignee = partnerPage.ownerId === user.id;
    }
  }

  if (!isOwner && !isAssignee)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Verify the OSP row is active before confirming
  const osp = await prisma.orderStepProgress.findUnique({
    where: { orderId_stepId: { orderId, stepId } },
    select: { status: true },
  });
  if (!osp) return NextResponse.json({ error: "Step progress not found" }, { status: 404 });
  if (osp.status !== "active")
    return NextResponse.json({ error: `Step is '${osp.status}', not active` }, { status: 400 });

  // Confirm this step
  await prisma.orderStepProgress.update({
    where: { orderId_stepId: { orderId, stepId } },
    data:  { status: "confirmed", confirmedAt: new Date() },
  });

  // Advance to next step (or mark delivered)
  await advanceToNextStep(orderId, stepId);

  // Fire-and-forget: notify the next step's assignee
  (async () => {
    try {
      const currentStep = await prisma.workflowStep.findUnique({
        where: { id: stepId },
        select: { initiativeId: true, sequence: true },
      });
      if (!currentStep) return;
      const nextStep = await prisma.workflowStep.findFirst({
        where: { initiativeId: currentStep.initiativeId, sequence: { gt: currentStep.sequence } },
        orderBy: { sequence: "asc" },
        select: { name: true, assigneeId: true },
      });
      if (!nextStep?.assigneeId) return;
      const collab = await prisma.collaboration.findUnique({
        where: { id: nextStep.assigneeId },
        include: {
          requester: { select: { ownerId: true } },
          receiver:  { select: { ownerId: true } },
        },
      });
      if (!collab) return;
      const storePageId = order.store.pageId;
      const partnerPage = storePageId && collab.requesterId === storePageId ? collab.receiver : collab.requester;
      if (!partnerPage.ownerId) return;
      const notifLink = collab.role === "delivery_partner"
        ? "/earn/deliveries"
        : "/app/orders?tab=my";
      await createNotification({
        userId: partnerPage.ownerId,
        type: "order_assigned",
        title: "New assignment",
        body: `You have been assigned to step "${nextStep.name}" for Order #${orderId.slice(-8).toUpperCase()}`,
        link: notifLink,
      });
    } catch {}
  })();

  return NextResponse.json({ ok: true });
}
