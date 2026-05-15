import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import getServerUser from "@/lib/serverAuth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  const user = await getServerUser(req);

  const [agg, userRow] = await Promise.all([
    db.productRating.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    user
      ? db.productRating.findUnique({
          where: { productId_userId: { productId, userId: user.id } },
          select: { rating: true },
        })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    average: agg._avg.rating ?? 0,
    count: agg._count.rating,
    userRating: userRow?.rating ?? null,
  });
}
