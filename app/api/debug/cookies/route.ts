// app/api/debug/cookies/route.ts
import { NextResponse } from "next/server";

// keep as edge so the bundle stays tiny
export const runtime = "edge";

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
        // Call internal server route to do heavy verification.
        // Use same origin derived from incoming request (works in dev & prod).
        const origin = new URL(req.url).origin;
        const res = await fetch(`${origin}/api/server/verify-session`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // optional: internal header to help server route accept only internal calls
            "x-internal-call": "1",
          },
          body: JSON.stringify({ token: session }),
        });

        if (res.ok) {
          sessionPayload = await res.json();
          sessionValid = !!(sessionPayload && sessionPayload.userId);
        } else {
          sessionPayload = {
            error: `verifier returned status ${res.status}`,
            body: await res.text().catch(() => null),
          };
        }
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
