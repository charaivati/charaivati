import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { isUnitType } from "@/lib/civic/constants";

// GET /api/civic/units?type=ward — list units for the home-unit picker.
// Default lists home-eligible units (ward + panchayat) with their parent chain names.
export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const typeParam = req.nextUrl.searchParams.get("type");
  const types = typeParam && isUnitType(typeParam) ? [typeParam] : ["ward", "panchayat"];

  const units = await prisma.unit.findMany({
    where: { type: { in: types } },
    include: { parent: { include: { parent: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    units: units.map((u) => ({
      id: u.id,
      type: u.type,
      name: u.name,
      parentName: u.parent?.name ?? null,
      grandparentName: u.parent?.parent?.name ?? null,
    })),
  });
}
