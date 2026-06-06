// app/api/business/claim-guest-ideas/route.ts
// POST — transfers all BusinessIdea rows from a guest session to the logged-in user.
// Called automatically on login and on email verification (magic link).
// Idempotent: already-claimed ideas (userId set) are skipped.

import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { claimGuestIdeas } from "@/lib/business/claimGuestIdeas";

const GUEST_COOKIE = "biz-guest";

export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifySessionToken(token) : null;

  if (!payload?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const guestSessionId = req.cookies.get(GUEST_COOKIE)?.value ?? null;
  if (!guestSessionId) {
    return NextResponse.json({ ok: true, claimed: 0 });
  }

  try {
    await claimGuestIdeas(guestSessionId, payload.userId);
    const res = NextResponse.json({ ok: true });
    // Clear the guest cookie now that it's claimed
    res.cookies.set(GUEST_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  } catch (error) {
    console.error("POST /api/business/claim-guest-ideas", error);
    return NextResponse.json({ error: "Failed to claim ideas" }, { status: 500 });
  }
}
