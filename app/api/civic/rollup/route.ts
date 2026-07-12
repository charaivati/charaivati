import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

// GET /api/civic/rollup?unitId=X  — aggregate view over every ward/panchayat
// under a higher unit (assembly/parliamentary/state/country).
// GET /api/civic/rollup?scope=earth — planet-wide aggregate over all wards.
//
// Rollups are the ONLY civic surface above ward level (Nation/Earth doctrine:
// aggregation, not issue boards — national issue lists become opinion
// shouting). Demands are raised and supported only in home wards; higher
// layers show sums. Descendant walk is an iterative parentId BFS (chain depth
// bounded by UNIT_TYPES); fine at current scale — revisit with a recursive
// CTE if unit counts grow large.
export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const unitId = req.nextUrl.searchParams.get("unitId");
  const scope = req.nextUrl.searchParams.get("scope");

  let unit: { id: string; type: string; name: string } | null = null;
  let wardIds: string[] = [];
  let countryCount: number | undefined;

  if (scope === "earth") {
    const wards = await prisma.unit.findMany({
      where: { type: { in: ["ward", "panchayat"] } },
      select: { id: true },
    });
    wardIds = wards.map((w) => w.id);
    countryCount = await prisma.unit.count({ where: { type: "country" } });
  } else if (unitId) {
    const found = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, type: true, name: true },
    });
    if (!found) return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    unit = found;

    if (found.type === "ward" || found.type === "panchayat") {
      wardIds = [found.id];
    } else {
      let frontier = [found.id];
      while (frontier.length > 0) {
        const children: { id: string; type: string }[] = await prisma.unit.findMany({
          where: { parentId: { in: frontier } },
          select: { id: true, type: true },
        });
        wardIds.push(
          ...children.filter((c) => c.type === "ward" || c.type === "panchayat").map((c) => c.id)
        );
        frontier = children
          .filter((c) => c.type !== "ward" && c.type !== "panchayat")
          .map((c) => c.id);
      }
    }
  } else {
    return NextResponse.json({ error: "unitId or scope=earth required" }, { status: 400 });
  }

  if (wardIds.length === 0) {
    return NextResponse.json({
      unit,
      wardCount: 0,
      residentCount: 0,
      countryCount: countryCount ?? undefined,
      counts: { proposed: 0, active: 0, complete: 0, archived: 0 },
      topIssues: [],
      recentDone: [],
    });
  }

  const [residentCount, statusGroups, topIssues, recentDone] = await Promise.all([
    prisma.user.count({ where: { homeUnitId: { in: wardIds } } }),
    prisma.issue.groupBy({
      by: ["status"],
      where: { unitId: { in: wardIds } },
      _count: { _all: true },
    }),
    prisma.issue.findMany({
      where: { unitId: { in: wardIds }, status: { in: ["proposed", "active"] } },
      orderBy: [{ supporterCount: "desc" }, { createdAt: "desc" }],
      take: 10,
      include: { unit: { select: { id: true, name: true } } },
    }),
    prisma.issue.findMany({
      where: { unitId: { in: wardIds }, status: "complete" },
      orderBy: [{ resolvedAt: "desc" }, { updatedAt: "desc" }],
      take: 5,
      include: { unit: { select: { id: true, name: true } } },
    }),
  ]);

  const counts: Record<string, number> = { proposed: 0, active: 0, complete: 0, archived: 0 };
  for (const g of statusGroups) counts[g.status] = g._count._all;

  const shape = (i: (typeof topIssues)[number]) => ({
    id: i.id,
    title: i.title,
    status: i.status,
    supporterCount: i.supporterCount,
    unitId: i.unit.id,
    unitName: i.unit.name,
    resolvedAt: i.resolvedAt,
    createdAt: i.createdAt,
  });

  return NextResponse.json({
    unit,
    wardCount: wardIds.length,
    residentCount,
    countryCount: countryCount ?? undefined,
    counts,
    topIssues: topIssues.map(shape),
    recentDone: recentDone.map(shape),
  });
}
