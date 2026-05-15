import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import getServerUser from "@/lib/serverAuth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId } = await params;
  const { rating } = await req.json();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "rating must be 1–5" }, { status: 400 });
  }

  const block = await db.storeBlock.findUnique({
    where: { id: productId },
    select: { section: { select: { store: { select: { ownerId: true } } } } },
  });
  if (!block) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const ownerId = block.section?.store?.ownerId;
  if (ownerId === user.id) {
    return NextResponse.json({ error: "Cannot rate your own product" }, { status: 403 });
  }

  await db.productRating.upsert({
    where: { productId_userId: { productId, userId: user.id } },
    create: { productId, userId: user.id, rating },
    update: { rating },
  });

  const agg = await db.productRating.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return NextResponse.json({
    average: agg._avg.rating ?? 0,
    count: agg._count.rating,
  });
}
