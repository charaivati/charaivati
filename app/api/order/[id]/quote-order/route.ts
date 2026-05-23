import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

type Params = { params: Promise<{ id: string }> };

type SummaryEntry = { quoteId: string; partyName: string; amount: number | null; status: string };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: orderId } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { store: { select: { ownerId: true } } },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.store.ownerId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as { summary?: SummaryEntry[] };
  if (!Array.isArray(body.summary))
    return NextResponse.json({ error: "summary array required" }, { status: 400 });

  await prisma.order.update({
    where: { id: orderId },
    data: { quoteSummary: body.summary },
  });

  return NextResponse.json({ ok: true });
}
