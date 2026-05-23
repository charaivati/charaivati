import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

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

  const body = await req.json() as { amount?: number };
  if (typeof body.amount !== "number" || body.amount <= 0)
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: {
      id: true, orderId: true, stepId: true, requestedPartyId: true, status: true,
    },
  });
  if (!quote || quote.orderId !== orderId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (quote.status !== "pending")
    return NextResponse.json({ error: "Quote already responded" }, { status: 400 });

  // Verify the caller is the party referenced by requestedPartyId (Collaboration.id)
  const collab = await prisma.collaboration.findUnique({
    where: { id: quote.requestedPartyId },
    include: {
      requester: { select: { ownerId: true } },
      receiver:  { select: { ownerId: true } },
    },
  });
  if (!collab) return NextResponse.json({ error: "Collaboration not found" }, { status: 404 });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { store: { select: { pageId: true } } },
  });
  const storePageId = order?.store.pageId;
  const partnerPage =
    storePageId && collab.requesterId === storePageId ? collab.receiver : collab.requester;

  if (partnerPage.ownerId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Update this quote
  await prisma.quote.update({
    where: { id: quoteId },
    data: { amount: body.amount, status: "submitted" },
  });

  // Rebuild quoteSummary sorted by amount asc
  const allQuotes = await prisma.quote.findMany({
    where: { orderId, stepId: quote.stepId },
    include: {
      step: { select: { id: true } },
    },
    orderBy: { amount: "asc" },
  });

  // Fetch party names for summary
  const collabIds = [...new Set(allQuotes.map((q) => q.requestedPartyId))];
  const collabs = await prisma.collaboration.findMany({
    where: { id: { in: collabIds } },
    include: {
      requester: { select: { id: true, title: true } },
      receiver:  { select: { id: true, title: true } },
    },
  });
  const nameMap = new Map(
    collabs.map((c) => [
      c.id,
      storePageId && c.requesterId === storePageId ? c.receiver.title : c.requester.title,
    ])
  );

  const summary = allQuotes.map((q) => ({
    quoteId:   q.id,
    partyName: nameMap.get(q.requestedPartyId) ?? "Unknown",
    amount:    q.amount,
    status:    q.status,
  }));

  await prisma.order.update({
    where: { id: orderId },
    data: { quoteSummary: summary },
  });

  return NextResponse.json({ ok: true, summary });
}
