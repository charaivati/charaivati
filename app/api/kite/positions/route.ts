import { NextRequest, NextResponse } from "next/server";
import { getKiteToken, kiteGet, KiteAuthError, KITE_COOKIE } from "@/lib/kite";

export async function GET(req: NextRequest) {
  const token = getKiteToken(req);
  if (!token) return NextResponse.json({ connected: false }, { status: 401 });

  try {
    const data = await kiteGet("/portfolio/positions", token);
    return NextResponse.json({ connected: true, positions: data?.net ?? [] });
  } catch (e) {
    if (e instanceof KiteAuthError) {
      const res = NextResponse.json({ connected: false, expired: true }, { status: 401 });
      res.cookies.set(KITE_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
