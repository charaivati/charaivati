import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { authUserId } from "@/lib/requests/common";

// FLEET-STATE-1b P1 — provider presence.
// POST /api/presence { lat, lng, mode } — a provider reports their live position
// (mode="available") or goes dark (mode="offline"). seenAt is stamped server-side.
// Freshness is judged at READ time in eligibility (5 min) — this route just records.
// Raw SQL (ProviderPresence isn't in the stale typed client) — same pattern as 1b/1c.
//
// P1 modes only: "offline" | "available". on_job/near_complete arrive in P2.
const VALID_MODES = new Set(["offline", "available"]);

export async function POST(req: NextRequest) {
  const userId = await authUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const mode = VALID_MODES.has(body.mode) ? body.mode : "available";

  let lat: number | null = null, lng: number | null = null;
  if (mode === "available") {
    lat = Number(body.lat); lng = Number(body.lng);
    if (isNaN(lat) || isNaN(lng))
      return NextResponse.json({ error: "lat and lng are required when available." }, { status: 400 });
  }

  // Upsert on the unique userId. seenAt=NOW() so a stale row is refreshed on every report.
  await prisma.$executeRaw`
    INSERT INTO "ProviderPresence" (id, "userId", lat, lng, "seenAt", mode)
    VALUES (${randomUUID()}, ${userId}, ${lat}, ${lng}, NOW(), ${mode})
    ON CONFLICT ("userId") DO UPDATE
      SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, "seenAt" = NOW(), mode = EXCLUDED.mode
  `;

  return NextResponse.json({ ok: true, mode });
}
