import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

type Params = { params: Promise<{ id: string }> };

// Owner manually confirms a UPI payment after checking their own UPI app (claimed → verified)
// or reverts it (→ claimed). Platform never auto-verifies — see CheckoutPayment.tsx.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: orderId } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { paymentStatus } = await req.json();
  if (paymentStatus !== "verified" && paymentStatus !== "claimed") {
    return NextResponse.json({ error: "Invalid paymentStatus" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { store: { select: { ownerId: true } } },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.store.ownerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.$executeRaw`UPDATE "Order" SET "paymentStatus" = ${paymentStatus} WHERE id = ${orderId}`;
  return NextResponse.json({ ok: true, paymentStatus });
}
