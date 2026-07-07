import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

// GET /api/civic/units/[unitId] — unit header data for the issue board:
// unit + parent chain, resident count on the platform, caller's membership.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ unitId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { unitId } = await params;

  const [unit, residentCount, me] = await Promise.all([
    prisma.unit.findUnique({
      where: { id: unitId },
      include: { parent: { include: { parent: { include: { parent: true } } } } },
    }),
    prisma.user.count({ where: { homeUnitId: unitId } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { homeUnitId: true } }),
  ]);

  if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });

  const chain: { id: string; type: string; name: string }[] = [];
  let p: any = unit.parent;
  while (p) {
    chain.push({ id: p.id, type: p.type, name: p.name });
    p = p.parent;
  }

  return NextResponse.json({
    unit: { id: unit.id, type: unit.type, name: unit.name },
    parents: chain,
    residentCount,
    isHomeUnit: me?.homeUnitId === unitId,
    myHomeUnitId: me?.homeUnitId ?? null,
  });
}
