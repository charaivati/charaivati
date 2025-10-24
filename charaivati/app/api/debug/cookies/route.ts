// app/api/debug/cookies/route.ts
import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/session"; // <- correct
export const runtime = "edge" as const;

function parseCookiesFromReq(req: Request) {
  const map: Record<string, string> = {};
  const header = req.headers.get("cookie") || "";
  header
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const [k, ...rest] = pair.split("=");
      map[k] = decodeURIComponent(rest.join("="));
    });
  return map;
}

export async function GET(req: Request) {
  try {
    const cookies = parseCookiesFromReq(req);
    const session = cookies["charaivati.session"] ?? cookies["session"] ?? null;
    const devEmail = cookies["dev_email"] ?? null;

    let sessionPayload: any = null;
    let sessionValid = false;
    if (session) {
      try {
        sessionPayload = await verifySessionToken(session); // await here
        sessionValid = !!(sessionPayload && sessionPayload.userId);
      } catch (e) {
        sessionPayload = { error: String(e) };
      }
    }

    return NextResponse.json({
      ok: true,
      receivedCookieHeader: req.headers.get("cookie") ?? null,
      cookies,
      devEmail,
      session,
      sessionValid,
      sessionPayload,
      now: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
