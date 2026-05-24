import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/createNotification";

type QuoteStep = {
  id: string;
  assigneeId: string | null;
  assigneeIds: string[];
  assigneeType: string;
  quoteTimeoutHours: number;
  initiativeId: string;
};

export async function triggerQuoteRequests(
  orderId: string,
  step: QuoteStep
): Promise<void> {
  // Skip quote creation for team_member steps — they don't bid
  if (step.assigneeType === "team_member") {
    console.log(`Skipping quotes for team_member step ${step.id}`);
    return;
  }

  // Collect from deprecated scalar fields (kept for backwards compat)
  const legacyIds = [
    ...(step.assigneeId ? [step.assigneeId] : []),
    ...step.assigneeIds,
  ];

  // Also collect from WorkflowStepAssignee rows (new system)
  const wsaRows = await (prisma as any).workflowStepAssignee.findMany({
    where: { stepId: step.id },
    select: { collaborationId: true },
  }) as { collaborationId: string }[];
  const wsaIds = wsaRows.map((r) => r.collaborationId);

  const partyIds = [...legacyIds, ...wsaIds].filter(
    (v, i, a) => a.indexOf(v) === i
  ); // dedupe

  if (partyIds.length === 0) return;

  // Skip if all assigned collaborations are team-scoped
  const collabScopes = await prisma.collaboration.findMany({
    where: { id: { in: partyIds } },
    select: { scope: true },
  });
  if (collabScopes.length > 0 && collabScopes.every((c) => c.scope === "team")) {
    console.log(`Skipping quotes for team-scoped collaborations on step ${step.id}`);
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      items: true,
      store: { select: { pageId: true, ownerId: true } },
    },
  });

  if (!order) return;

  const storePageId = order.store.pageId;
  const expiresAt = new Date(Date.now() + step.quoteTimeoutHours * 3600 * 1000);
  const orderRef = `#${orderId.slice(-8).toUpperCase()}`;
  const itemSummary = order.items.map((i) => `${i.title} ×${i.quantity}`).join(", ");
  const msgText = `Quote request for Order ${orderRef}: ${itemSummary}. Please reply with your price. This request expires in ${step.quoteTimeoutHours} hours.`;

  for (const collabId of partyIds) {
    const collab = await prisma.collaboration.findUnique({
      where: { id: collabId },
      include: {
        requester: { select: { id: true, ownerId: true } },
        receiver:  { select: { id: true, ownerId: true } },
      },
    });
    if (!collab) continue;

    // Create the Quote row (skip if already exists)
    await prisma.quote.create({
      data: { orderId, stepId: step.id, requestedPartyId: collabId, status: "pending", expiresAt },
    }).catch(() => { /* skip duplicate */ });

    // Determine partner userId for chat
    const partnerPage =
      storePageId && collab.requesterId === storePageId ? collab.receiver : collab.requester;
    const partnerUserId = partnerPage.ownerId;
    const ownerUserId   = order.store.ownerId;
    if (!partnerUserId || partnerUserId === ownerUserId) continue;

    // Stable canonical ordering for ChatConversation (userA < userB)
    const userAId = ownerUserId < partnerUserId ? ownerUserId : partnerUserId;
    const userBId = ownerUserId < partnerUserId ? partnerUserId : ownerUserId;

    let conv = await prisma.chatConversation.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    });
    if (!conv) {
      conv = await prisma.chatConversation.create({ data: { userAId, userBId } });
    }

    // Store as plaintext with iv="system" — marks a server-generated message
    await prisma.chatMessage.create({
      data: { conversationId: conv.id, senderId: ownerUserId, ciphertext: msgText, iv: "system" },
    });

    // Notify the third-party that a quote has been requested
    await createNotification({
      userId: partnerUserId,
      type: "quote_requested",
      title: "Quote requested",
      body: `A quote has been requested for Order ${orderRef}`,
      link: "/app/orders?tab=requests",
    });
  }

  // In-process timeout: mark pending quotes rejected if not answered in time
  setTimeout(async () => {
    try {
      const pending = await prisma.quote.findMany({
        where: { orderId, stepId: step.id, status: "pending" },
        select: { id: true },
      });
      if (pending.length > 0) {
        await prisma.quote.updateMany({
          where: { orderId, stepId: step.id, status: "pending" },
          data: { status: "rejected" },
        });
        await prisma.order.update({
          where: { id: orderId },
          data: { requiresAttention: true },
        });
      }
    } catch (e) {
      console.error("Quote timeout check failed:", e);
    }
  }, step.quoteTimeoutHours * 3600 * 1000);
}
