import { NextRequest, NextResponse } from "next/server";
import { exchangeToken, KITE_COOKIE } from "@/lib/kite";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const requestToken = url.searchParams.get("request_token");
  const status = url.searchParams.get("status");

  // ponytail: build the redirect base from the real request host (x-forwarded-* on
  // Vercel, Host header in dev) — req.url gets normalized to localhost by Next, which
  // splits the cookie host from where the user is actually browsing (127.0.0.1).
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const base = `${proto}://${host}`;
  const to = (path: string) => NextResponse.redirect(new URL(path, base));

  if (status !== "success" || !requestToken) {
    return to("/market?kite=denied");
  }

  try {
    const accessToken = await exchangeToken(requestToken);
    const res = to("/market");
    res.cookies.set(KITE_COOKIE, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12, // token dies daily anyway; ~one trading day
    });
    return res;
  } catch (e) {
    console.error("[kite/callback] token exchange failed:", (e as Error).message);
    return to("/market?kite=error");
  }
}
