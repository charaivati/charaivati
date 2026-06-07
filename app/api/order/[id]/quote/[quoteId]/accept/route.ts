import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { advanceToNextStep } from "@/lib/workflow/advanceToNextStep";
import { createSubOrder } from "@/lib/workflow/createSubOrder";

type Params = { params: Promise<{ id: string; quoteId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id: orderId, quoteId } = await params;
  let user = await getServerUser(req);
  // TEST ONLY — never deploy with ALLOW_TEST_BYPASS=true
  if (!user && process.env.ALLOW_TEST_BYPASS === "true") {
    const tid = req.headers.get("x-test-userid");
    if (tid) user = await prisma.user.findUnique({ where: { id: tid }, select: { id: true, email: true, name: true } });
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { storeId: true, store: { select: { ownerId: true, pageId: true } } },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.store.ownerId !== user.id)
    return NextResponse.json({ error: "Forbidden — owner only" }, { status: 403 });

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { id: true, orderId: true, stepId: true, requestedPartyId: true, status: true, amount: true },
  });
  if (!quote || quote.orderId !== orderId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (quote.status === "accepted")
    return NextResponse.json({ error: "Already accepted" }, { status: 400 });

  // Accept this quote, reject all others for the same step
  await prisma.$transaction([
    prisma.quote.update({ where: { id: quoteId }, data: { status: "accepted" } }),
    prisma.quote.updateMany({
      where: { orderId, stepId: quote.stepId, id: { not: quoteId } },
      data:  { status: "rejected" },
    }),
  ]);

  // Fetch activityType via raw SQL — new column not in stale Prisma client
  const activityRaw = await prisma.$queryRaw<{ activityType: string }[]>`
    SELECT "activityType" FROM "WorkflowStep" WHERE id = ${quote.stepId}
  `;
  const activityType = activityRaw[0]?.activityType ?? "normal";

  // Only delivery steps dispatch via the Order's delivery-pipeline fields.
  // Normal/service steps must not write assignedToId/partnerStatus — that
  // would funnel the assignee into /earn/deliveries GPS dispatch.
  if (activityType === "delivery") {
    await (prisma.order as any).update({
      where: { id: orderId },
      data: { assignedToId: quote.requestedPartyId, partnerStatus: "assigned" },
    });
  }

  await prisma.orderStepProgress.updateMany({
    where: { orderId, stepId: quote.stepId, status: "active" },
    data:  { status: "confirmed", confirmedAt: new Date() },
  });

  // Advance to next step
  await advanceToNextStep(orderId, quote.stepId);

  // Create sub-order for the accepted party (fire-and-forget)
  ;(async () => {
    try {
      const collab = await prisma.collaboration.findUnique({
        where: { id: quote.requestedPartyId },
        include: {
          requester:    { select: { ownerId: true } },
          receiverPage: { select: { ownerId: true } },
        },
      });
      if (!collab) return;
      const storePageId = order.store.pageId;
      const partnerPage = storePageId && collab.requesterId === storePageId
        ? collab.receiverPage
        : collab.requester;
      if (!partnerPage?.ownerId) return;

      const step = await prisma.workflowStep.findUnique({
        where: { id: quote.stepId },
        select: { name: true },
      });
      if (!step) return;

      await createSubOrder({
        parentOrderId:  orderId,
        assigneeUserId: partnerPage.ownerId,
        storeId:        order.storeId,
        stepId:         quote.stepId,
        stepName:       step.name,
        agreedAmount:   quote.amount ?? undefined,
        subOrderType:   "service",
      });
    } catch {}
  })();

  return NextResponse.json({ ok: true });
}
