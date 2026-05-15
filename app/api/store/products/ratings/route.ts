import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import getServerUser from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  const ids = new URL(req.url).searchParams.get("ids")
    ?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

  if (ids.length === 0) return NextResponse.json({});

  const user = await getServerUser(req);

  const [grouped, userRatings] = await Promise.all([
    db.productRating.groupBy({
      by: ["productId"],
      where: { productId: { in: ids } },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    user
      ? db.productRating.findMany({
          where: { productId: { in: ids }, userId: user.id },
          select: { productId: true, rating: true },
        })
      : Promise.resolve([]),
  ]);

  const userMap: Record<string, number> = {};
  for (const r of userRatings) userMap[r.productId] = r.rating;

  const result: Record<string, { average: number; count: number; userRating: number | null }> = {};
  for (const g of grouped) {
    result[g.productId] = {
      average: Math.round((g._avg.rating ?? 0) * 10) / 10,
      count: g._count.rating,
      userRating: userMap[g.productId] ?? null,
    };
  }
  for (const id of ids) {
    if (!result[id]) result[id] = { average: 0, count: 0, userRating: null };
  }

  return NextResponse.json(result);
}
