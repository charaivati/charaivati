import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import {
  AREA_PARAMETERS,
  isAreaParameter,
  RATING_MIN,
  RATING_MAX,
} from "@/lib/civic/constants";

// Area quality ratings — fixed parameters (water, electricity, …) every
// resident rates 1–5 for their HOME unit; everyone in the area sees the
// average. Doctrine mirrors issues: rating is resident-only (homeUnitId must
// match) so area scores can't be brigaded; reading is open to any signed-in
// user. One row per user × unit × parameter, updatable any time (people's
// water supply changes; the score should too).

// GET /api/civic/ratings?unitId=X
// → { parameters, averages: {param: {avg, count}}, mine: {param: score}, canRate }
export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const unitId = req.nextUrl.searchParams.get("unitId");
  if (!unitId) return NextResponse.json({ error: "unitId required" }, { status: 400 });

  const [unit, me, groups, myRows] = await Promise.all([
    prisma.unit.findUnique({ where: { id: unitId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { homeUnitId: true } }),
    prisma.unitRating.groupBy({
      by: ["parameter"],
      where: { unitId },
      _avg: { score: true },
      _count: { _all: true },
    }),
    prisma.unitRating.findMany({
      where: { unitId, userId: user.id },
      select: { parameter: true, score: true },
    }),
  ]);
  if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });

  const averages: Record<string, { avg: number; count: number }> = {};
  for (const g of groups) {
    averages[g.parameter] = {
      avg: Math.round((g._avg.score ?? 0) * 10) / 10,
      count: g._count._all,
    };
  }
  const mine: Record<string, number> = {};
  for (const r of myRows) mine[r.parameter] = r.score;

  return NextResponse.json({
    parameters: AREA_PARAMETERS,
    averages,
    mine,
    canRate: me?.homeUnitId === unitId,
  });
}

// POST /api/civic/ratings — { unitId, parameter, score } (upsert, resident-only)
export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { unitId, parameter, score } = await req.json().catch(() => ({}));
  if (!unitId || typeof unitId !== "string") {
    return NextResponse.json({ error: "unitId required" }, { status: 400 });
  }
  if (!isAreaParameter(parameter)) {
    return NextResponse.json({ error: "Unknown parameter" }, { status: 400 });
  }
  const cleanScore = Number(score);
  if (!Number.isInteger(cleanScore) || cleanScore < RATING_MIN || cleanScore > RATING_MAX) {
    return NextResponse.json(
      { error: `score must be an integer ${RATING_MIN}–${RATING_MAX}` },
      { status: 400 }
    );
  }

  const [unit, me] = await Promise.all([
    prisma.unit.findUnique({ where: { id: unitId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { homeUnitId: true } }),
  ]);
  if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  if (me?.homeUnitId !== unitId) {
    return NextResponse.json(
      { error: "Only residents of this area can rate it." },
      { status: 403 }
    );
  }

  await prisma.unitRating.upsert({
    where: { userId_unitId_parameter: { userId: user.id, unitId, parameter } },
    update: { score: cleanScore },
    create: { userId: user.id, unitId, parameter, score: cleanScore },
  });

  // Return fresh average for the parameter so the UI can update in place.
  const agg = await prisma.unitRating.aggregate({
    where: { unitId, parameter },
    _avg: { score: true },
    _count: { _all: true },
  });

  return NextResponse.json({
    ok: true,
    parameter,
    average: {
      avg: Math.round((agg._avg.score ?? 0) * 10) / 10,
      count: agg._count._all,
    },
  });
}
