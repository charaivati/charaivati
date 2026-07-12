import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { HOME_UNIT_CHANGE_DAYS } from "@/lib/civic/constants";

// GET /api/civic/home-unit — the caller's current home unit (bootstrap for
// the Society Panchayat/Ward tab and the /local index redirect).
export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { homeUnit: { select: { id: true, type: true, name: true } } },
  });

  return NextResponse.json({
    homeUnitId: me?.homeUnit?.id ?? null,
    unit: me?.homeUnit ?? null,
  });
}

// POST /api/civic/home-unit — set the caller's home unit (ward/panchayat only;
// membership in higher units is derived via the parent chain). One home
// location, changeable at most once per HOME_UNIT_CHANGE_DAYS — this is the
// brigading protection, do not loosen it for convenience.
export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { unitId } = await req.json().catch(() => ({}));
  if (!unitId) return NextResponse.json({ error: "unitId required" }, { status: 400 });

  const [unit, me] = await Promise.all([
    prisma.unit.findUnique({ where: { id: unitId } }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { homeUnitId: true, homeUnitChangedAt: true },
    }),
  ]);
  if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  if (unit.type !== "ward" && unit.type !== "panchayat") {
    return NextResponse.json(
      { error: "Home unit must be a ward or panchayat." },
      { status: 400 }
    );
  }
  if (me?.homeUnitId === unitId) return NextResponse.json({ ok: true, unchanged: true });

  if (me?.homeUnitId && me.homeUnitChangedAt) {
    const nextAllowed =
      me.homeUnitChangedAt.getTime() + HOME_UNIT_CHANGE_DAYS * 24 * 3600 * 1000;
    if (Date.now() < nextAllowed) {
      const days = Math.ceil((nextAllowed - Date.now()) / (24 * 3600 * 1000));
      return NextResponse.json(
        { error: `Home location can be changed again in ${days} days.` },
        { status: 429 }
      );
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { homeUnitId: unitId, homeUnitChangedAt: new Date() },
  });

  return NextResponse.json({ ok: true, homeUnitId: unitId });
}
