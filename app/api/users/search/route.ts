// app/api/users/search/route.ts
//
// PRIV-ACT-1: hardened user search. Returns only id/name/avatarUrl/location —
// NEVER email or phone, and never to non-discoverable or guest accounts.
// Search inputs are name (+ optional location string to narrow) only —
// searching BY email/phone was itself a privacy leak and has been removed.
import { NextResponse } from "next/server";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { checkRateLimit } from "@/lib/rateLimit";
import { searchUsers } from "@/lib/users/searchUsers";

export async function GET(req: Request) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await checkRateLimit(`users-search:${payload.userId}`, 30, 60);
  if (!rate.ok) {
    return NextResponse.json({ ok: false, error: "Too many searches — try again shortly." }, { status: 429 });
  }

  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? url.searchParams.get("query") ?? "").trim();
    const location = (url.searchParams.get("location") ?? "").trim();

    if (!q) {
      return NextResponse.json({ ok: true, users: [] });
    }

    const results = await searchUsers({ q, location, excludeUserId: payload.userId });

    return NextResponse.json({ ok: true, users: results });
  } catch (err: any) {
    console.error("users/search error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
