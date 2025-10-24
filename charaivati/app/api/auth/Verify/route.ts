// app/api/auth/verify/route.ts
import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/token";
import { createSessionToken, setSessionCookie } from "@/lib/session";

// only allow redirects to these internal pathnames
const ALLOWED_REDIRECTS = new Set<string>([
  "/", 
  "/user",
  "/dashboard",
  "/profile",
  "/select-country", // allow ad flow to redirect back
  "/local",          // allow deep links (optional)
]);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const type = searchParams.get("type") || "verify-email";
    // requestedRedirect may include query string, e.g. "/select-country?lang=hi"
    const requestedRedirect = searchParams.get("redirect") || "/user";

    if (!token) {
      const url = new URL("/auth/invalid?reason=no-token", req.nextUrl.origin);
      return NextResponse.redirect(url);
    }

    // Determine safe redirect pathname:
    let safeRedirectPath = "/user";
    try {
      // If requestedRedirect starts with "/", treat as internal path (may have query)
      if (requestedRedirect && requestedRedirect.startsWith("/")) {
        // parse to extract pathname
        const parsed = new URL(requestedRedirect, req.nextUrl.origin);
        const pathname = parsed.pathname;
        if (ALLOWED_REDIRECTS.has(pathname)) {
          // use the full original requestedRedirect (with querystring) so query is preserved
          safeRedirectPath = requestedRedirect;
        }
      }
    } catch (err) {
      // fallback to /user on parse errors
      safeRedirectPath = "/user";
    }

    const redirectUrl = new URL(safeRedirectPath, req.nextUrl.origin);

    const tokenHash = hashToken(token);

    const record = await prisma.magicLink.findFirst({
      where: {
        tokenHash,
        type,
        used: false,
        expiresAt: { gte: new Date() },
      },
      include: { user: true },
    });

    if (!record) {
      const url = new URL("/auth/invalid?reason=invalid-or-expired", req.nextUrl.origin);
      return NextResponse.redirect(url);
    }

    const updated = await prisma.magicLink.updateMany({
      where: { id: record.id, used: false },
      data: { used: true, usedAt: new Date() },
    });

    if (updated.count === 0) {
      const url = new URL("/auth/invalid?reason=already-used", req.nextUrl.origin);
      return NextResponse.redirect(url);
    }

    if (type === "verify-email") {
      await prisma.user.update({
        where: { id: record.userId },
        data: { verified: true, emailVerified: true },
      });
    }

    const emailOrUndefined = record.user.email ?? undefined;

    const sessionToken = await createSessionToken(
      { userId: record.userId, email: emailOrUndefined },
      { expiresIn: "7d" }
    );

    const res = NextResponse.redirect(redirectUrl);
    res.headers.set("Cache-Control", "no-store");

    setSessionCookie(res, sessionToken);

    return res;
  } catch (err) {
    console.error("verify error:", err);
    const url = new URL("/auth/invalid?reason=server-error", new URL(req.url).origin);
    return NextResponse.redirect(url);
  }
}
