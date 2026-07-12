import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { HOME_UNIT_CHANGE_DAYS } from "@/lib/civic/constants";

// GET /api/civic/home-unit — the caller's current home unit plus its full
// ancestor chain (ward → assembly → parliamentary → state → country). The
// chain is what lets one panchayat/ward selection fill every higher layer:
// Society's Legislative/Parliamentary/State tabs, Nation's country view.
export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { homeUnitId: true, homeUnitChangedAt: true },
  });

  if (!me?.homeUnitId) {
    return NextResponse.json({ homeUnitId: null, unit: null, chain: [], autoPlaced: false });
  }

  // Walk parentId upward (chain depth is bounded by UNIT_TYPES).
  const chain: { id: string; type: string; name: string }[] = [];
  let cursor: string | null = me.homeUnitId;
  while (cursor) {
    const u: { id: string; type: string; name: string; parentId: string | null } | null =
      await prisma.unit.findUnique({
        where: { id: cursor },
        select: { id: true, type: true, name: true, parentId: true },
      });
    if (!u) break;
    chain.push({ id: u.id, type: u.type, name: u.name });
    cursor = u.parentId;
  }

  return NextResponse.json({
    homeUnitId: me.homeUnitId,
    unit: chain[0] ?? null,
    chain,
    // Placed from a saved address and never confirmed by the user — the
    // change lock hasn't started, so the UI should offer an easy correction.
    autoPlaced: me.homeUnitChangedAt === null,
  });
}

// POST /api/civic/home-unit — set the caller's home unit (ward/panchayat only;
// membership in higher units is derived via the parent chain). One home
// location, changeable at most once per HOME_UNIT_CHANGE_DAYS — this is the
// brigading protection, do not loosen it for convenience.
//
// { auto: true } is the address-based auto-placement path: it only applies
// when NO home unit is set yet, and it deliberately leaves homeUnitChangedAt
// null so the change lock does not start from a machine guess — the user's
// first manual pick stays free, and the lock starts from that confirmation.
export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { unitId, auto } = await req.json().catch(() => ({}));
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
  if (me && me.homeUnitId === unitId) {
    // Manually confirming an auto-placed unit upgrades it to a real choice:
    // the change lock starts now (auto-placement left homeUnitChangedAt null).
    if (auto !== true && me.homeUnitChangedAt === null) {
      await prisma.user.update({
        where: { id: user.id },
        data: { homeUnitChangedAt: new Date() },
      });
      return NextResponse.json({ ok: true, homeUnitId: unitId, confirmed: true });
    }
    return NextResponse.json({ ok: true, unchanged: true });
  }

  if (auto === true) {
    if (me?.homeUnitId) {
      return NextResponse.json(
        { error: "Home unit already set — auto-placement only applies to new users." },
        { status: 409 }
      );
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { homeUnitId: unitId }, // homeUnitChangedAt stays null — see above
    });
    return NextResponse.json({ ok: true, homeUnitId: unitId, auto: true });
  }

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
