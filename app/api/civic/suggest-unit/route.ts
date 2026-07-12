import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { AUTO_PLACE_SCORE } from "@/lib/civic/constants";

// GET /api/civic/suggest-unit — rank home-eligible units (ward/panchayat)
// against the caller's saved addresses so the picker can pre-fill (and, at
// high confidence, auto-place) the home area instead of making every user
// search manually. Matching is by name: unit + ancestor-chain names vs the
// address city/state/line1, optionally enriched with district/block/office
// names from the India Post pincode API. Only the caller's OWN addresses are
// read; nothing here writes — placement still goes through /api/civic/home-unit.

const PIN_API_TIMEOUT_MS = 2500;
const MAX_SUGGESTIONS = 5;

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Substring match in either direction; ignores very short strings (noise). */
function nameMatch(a: string, b: string): boolean {
  if (a.length < 4 || b.length < 4) return a === b && a.length > 0;
  return a.includes(b) || b.includes(a);
}

/** Shared tokens of length ≥ 4 between two normalized names. */
function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter((t) => t.length >= 4));
  return b.split(" ").filter((t) => t.length >= 4 && ta.has(t)).length;
}

type PinInfo = { names: string[] } | null;

/** District / block / post-office names for a pincode. Best-effort. */
async function lookupPincode(pincode: string): Promise<PinInfo> {
  if (!/^\d{6}$/.test(pincode)) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PIN_API_TIMEOUT_MS);
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const offices = data?.[0]?.PostOffice;
    if (!Array.isArray(offices)) return null;
    const names = new Set<string>();
    for (const o of offices) {
      for (const v of [o?.Name, o?.Block, o?.District]) {
        if (typeof v === "string" && v.trim()) names.add(norm(v));
      }
    }
    return { names: [...names] };
  } catch {
    return null; // offline / slow — name matching still works without it
  }
}

export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: { id: true, city: true, state: true, pincode: true, line1: true },
  });

  if (addresses.length === 0) {
    return NextResponse.json({ ok: true, address: null, suggestions: [], autoPlaceScore: AUTO_PLACE_SCORE });
  }

  // All units in one query → id map → ancestor names per home-eligible unit.
  const allUnits = await prisma.unit.findMany({
    select: { id: true, type: true, name: true, parentId: true, status: true },
  });
  const byId = new Map(allUnits.map((u) => [u.id, u]));
  const eligible = allUnits.filter((u) => u.type === "ward" || u.type === "panchayat");

  function ancestorsOf(unit: { parentId: string | null }): { name: string; norm: string }[] {
    const out: { name: string; norm: string }[] = [];
    let cursor = unit.parentId;
    while (cursor) {
      const p = byId.get(cursor);
      if (!p) break;
      out.push({ name: p.name, norm: norm(p.name) });
      cursor = p.parentId;
    }
    return out;
  }

  // Pincode enrichment from the first address that has one (best-effort).
  const pinAddress = addresses.find((a) => /^\d{6}$/.test(a.pincode));
  const pin = pinAddress ? await lookupPincode(pinAddress.pincode) : null;

  type Scored = {
    id: string;
    type: string;
    name: string;
    status: string;
    parentName: string | null;
    score: number;
    addressId: string;
    matchedOn: string[];
  };

  const scored: Scored[] = [];

  for (const unit of eligible) {
    const uNorm = norm(unit.name);
    const ancestors = ancestorsOf(unit);
    let best: { score: number; addressId: string; matchedOn: string[] } | null = null;

    for (const addr of addresses) {
      const city = norm(addr.city);
      const state = norm(addr.state);
      const line1 = norm(addr.line1);
      let score = 0;
      const matchedOn: string[] = [];

      if (city && (nameMatch(uNorm, city) || tokenOverlap(uNorm, city) > 0)) {
        score += 3; matchedOn.push("city");
      } else if (line1 && (nameMatch(uNorm, line1) || tokenOverlap(uNorm, line1) > 0)) {
        score += 2; matchedOn.push("address line");
      }
      if (city && ancestors.some((a) => nameMatch(a.norm, city) || tokenOverlap(a.norm, city) > 0)) {
        score += 2; matchedOn.push("city area");
      }
      if (state && ancestors.some((a) => nameMatch(a.norm, state))) {
        score += 1; matchedOn.push("state");
      }
      if (pin && addr.id === pinAddress?.id) {
        if (pin.names.some((n) => nameMatch(uNorm, n) || tokenOverlap(uNorm, n) > 0)) {
          score += 3; matchedOn.push("pincode locality");
        } else if (pin.names.some((n) => ancestors.some((a) => nameMatch(a.norm, n)))) {
          score += 1; matchedOn.push("pincode district");
        }
      }

      if (score > 0 && (!best || score > best.score)) {
        best = { score, addressId: addr.id, matchedOn };
      }
    }

    if (best) {
      scored.push({
        id: unit.id,
        type: unit.type,
        name: unit.name,
        status: unit.status,
        parentName: ancestorsOf(unit)[0]?.name ?? null,
        score: best.score,
        addressId: best.addressId,
        matchedOn: best.matchedOn,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, MAX_SUGGESTIONS);
  const primary = addresses[0];

  return NextResponse.json({
    ok: true,
    address: { id: primary.id, city: primary.city, state: primary.state, pincode: primary.pincode },
    suggestions: top,
    autoPlaceScore: AUTO_PLACE_SCORE,
  });
}
