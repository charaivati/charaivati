import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. Find all pages owned by the current user
  const userPages = await prisma.page.findMany({
    where: { ownerId: user.id },
    select: { id: true },
  });
  const pageIds = userPages.map((p) => p.id);
  if (pageIds.length === 0) return NextResponse.json([]);

  // 2. Find collaborations where the user's pages are involved
  const collabs = await prisma.collaboration.findMany({
    where: { OR: [{ requesterId: { in: pageIds } }, { receiverId: { in: pageIds } }] },
    select: { id: true },
  });
  const collabIds = collabs.map((c) => c.id);
  if (collabIds.length === 0) return NextResponse.json([]);

  // 3. Find all quotes addressed to these collaborations
  const quotes = await prisma.quote.findMany({
    where: { requestedPartyId: { in: collabIds } },
    orderBy: { createdAt: "desc" },
    include: {
      step:  { select: { name: true, sequence: true } },
      order: { select: { id: true, items: true, total: true, createdAt: true } },
    },
  });

  type QuoteResult = typeof quotes[0];

  const result = quotes.map((q: QuoteResult) => {
    const items = q.order.items as { title: string; quantity: number; price: number }[];
    const summary = items.slice(0, 2).map((i) => `${i.title} ×${i.quantity}`).join(", ")
      + (items.length > 2 ? ` +${items.length - 2} more` : "");
    return {
      id:              q.id,
      status:          q.status,
      amount:          q.amount,
      expiresAt:       q.expiresAt,
      orderId:         q.orderId,
      orderRef:        `#${q.orderId.slice(-8).toUpperCase()}`,
      stepName:        q.step.name,
      itemsSummary:    summary,
      requestedPartyId: q.requestedPartyId,
      createdAt:       q.createdAt,
    };
  });

  return NextResponse.json(result);
}
