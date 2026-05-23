import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

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

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { userId: true, deliveryStatus: true },
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

  return NextResponse.json({ ok: true });
}
