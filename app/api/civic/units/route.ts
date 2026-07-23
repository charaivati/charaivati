import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import { scanInput } from "@/lib/ai/guardRail";
import {
  isUnitType,
  PROPOSAL_PARENT_TYPES,
  UNIT_PROPOSALS_PER_DAY,
  UNIT_VERIFY_RESIDENTS,
} from "@/lib/civic/constants";

const NAME_MIN = 3;
const NAME_MAX = 80;

// GET /api/civic/units?type=ward&parentId=X — list units.
// Default lists home-eligible units (ward + panchayat) with their parent chain
// names, status (pending = community-proposed, not yet verified) and, for
// pending units, how many residents they have so the UI can show progress.
// ?type=assembly&state=X scopes to one state's assembly constituencies
// (assembly.parentId -> parliamentary, parliamentary.parentId -> state, so
// this is a two-hop filter) — UNITS-STATE-SCOPE-BUILD-1, avoids shipping all
// 4,040 seeded rows for a form that only needs one state's worth.
export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const typeParam = req.nextUrl.searchParams.get("type");
  const parentId = req.nextUrl.searchParams.get("parentId");
  const stateId = req.nextUrl.searchParams.get("state");
  const types = typeParam && isUnitType(typeParam) ? [typeParam] : ["ward", "panchayat"];
  const scopeToState = typeParam === "assembly" && !!stateId;

  const units = await prisma.unit.findMany({
    where: {
      type: { in: types },
      ...(parentId ? { parentId } : {}),
      ...(scopeToState ? { parent: { parentId: stateId } } : {}),
    },
    include: { parent: { include: { parent: true } } },
    orderBy: { name: "asc" },
  });

  // Resident counts for pending units only (verification progress display).
  const pendingIds = units.filter((u) => u.status === "pending").map((u) => u.id);
  const residentCounts = new Map<string, number>();
  if (pendingIds.length > 0) {
    const groups = await prisma.user.groupBy({
      by: ["homeUnitId"],
      where: { homeUnitId: { in: pendingIds } },
      _count: { _all: true },
    });
    for (const g of groups) {
      if (g.homeUnitId) residentCounts.set(g.homeUnitId, g._count._all);
    }
  }

  return NextResponse.json({
    verifyResidents: UNIT_VERIFY_RESIDENTS,
    units: units.map((u) => ({
      id: u.id,
      type: u.type,
      name: u.name,
      status: u.status,
      parentName: u.parent?.name ?? null,
      grandparentName: u.parent?.parent?.name ?? null,
      residentCount: u.status === "pending" ? residentCounts.get(u.id) ?? 0 : undefined,
    })),
  });
}

// POST /api/civic/units — propose a missing ward/panchayat (public-driven
// coverage: users create the dropdown, not seed data). Proposed units start
// status "pending" and verify automatically once UNIT_VERIFY_RESIDENTS users
// claim them as home (see /api/civic/home-unit). Guards: residents-only-name
// hygiene via scanInput, per-user daily rate limit, parent must be an existing
// assembly/parliamentary/state, duplicate names under the same parent are
// rejected (case-insensitive).
export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, type, parentId } = await req.json().catch(() => ({}));
  const cleanName = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";

  if (type !== "ward" && type !== "panchayat") {
    return NextResponse.json({ error: "type must be ward or panchayat" }, { status: 400 });
  }
  if (cleanName.length < NAME_MIN || cleanName.length > NAME_MAX) {
    return NextResponse.json(
      { error: `Name must be ${NAME_MIN}–${NAME_MAX} characters.` },
      { status: 400 }
    );
  }
  if (scanInput(cleanName).level === "BLOCK") {
    return NextResponse.json({ error: "That name can't be used." }, { status: 400 });
  }
  if (!parentId || typeof parentId !== "string") {
    return NextResponse.json({ error: "parentId required" }, { status: 400 });
  }

  const rl = await checkRateLimit(`civic-unit-propose:${user.id}`, UNIT_PROPOSALS_PER_DAY, 24 * 3600);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "You've added several areas recently — try again tomorrow." },
      { status: 429 }
    );
  }

  const parent = await prisma.unit.findUnique({ where: { id: parentId } });
  if (!parent) return NextResponse.json({ error: "Parent area not found" }, { status: 404 });
  if (!(PROPOSAL_PARENT_TYPES as readonly string[]).includes(parent.type)) {
    return NextResponse.json(
      { error: "New areas must be added under a state or constituency." },
      { status: 400 }
    );
  }

  // Duplicate guard: same normalized name under the same parent.
  const siblings = await prisma.unit.findMany({
    where: { parentId },
    select: { id: true, name: true, status: true },
  });
  const normalized = cleanName.toLowerCase();
  const existing = siblings.find((s) => s.name.trim().toLowerCase() === normalized);
  if (existing) {
    return NextResponse.json(
      { error: "This area already exists here — select it from the list.", unitId: existing.id },
      { status: 409 }
    );
  }

  const unit = await prisma.unit.create({
    data: { name: cleanName, type, parentId, status: "pending", proposedById: user.id },
    select: { id: true, name: true, type: true, status: true },
  });

  return NextResponse.json({ ok: true, unit });
}
