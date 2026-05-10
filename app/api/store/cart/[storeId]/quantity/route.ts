import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blockId, quantity } = await req.json();
  if (!blockId || typeof quantity !== "number" || quantity < 1) {
    return NextResponse.json({ error: "blockId and quantity >= 1 required" }, { status: 400 });
  }

  const item = await prisma.cartItem.update({
    where: { userId_blockId: { userId: user.id, blockId } },
    data: { quantity },
  });

  return NextResponse.json(item);
}
