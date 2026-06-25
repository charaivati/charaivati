import { NextRequest, NextResponse } from "next/server";
import { getKiteToken, KiteAuthError, KITE_COOKIE } from "@/lib/kite";
import { buildContext, SymbolNotFound } from "@/lib/kiteContext";

// Per-stock context packet. Works for any NSE symbol, not just holdings.
export async function GET(req: NextRequest) {
  const token = getKiteToken(req);
  if (!token) return NextResponse.json({ connected: false }, { status: 401 });

  const symbol = req.nextUrl.searchParams.get("symbol") || "";
  if (!symbol.trim()) return NextResponse.json({ error: "Missing symbol." }, { status: 400 });

  try {
    return NextResponse.json(await buildContext(symbol, token));
  } catch (e) {
    if (e instanceof KiteAuthError) {
      const res = NextResponse.json({ connected: false, expired: true }, { status: 401 });
      res.cookies.set(KITE_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }
    if (e instanceof SymbolNotFound) {
      return NextResponse.json({ error: (e as Error).message }, { status: 404 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
