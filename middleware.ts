import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";

const PROTECTED_ROUTES = ["/self", "/nation", "/earth", "/society"];

// Paths where neither the language gate nor auth gate should fire.
// /api/* and /_next/* are excluded at the matcher level (see config below).
const SKIP_PATHS = new Set(["/", "/login", "/register", "/journey"]);

// Static file extensions that should never trigger a redirect.
const STATIC_EXT = /\.(?:ico|png|jpe?g|svg|webp|js|css|woff2?)$/i;

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const { pathname } = url;

  // Verify session once — reused by both gates below.
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = await verifySessionToken(token);

  // ── 0. mustChangePassword gate ───────────────────────────────────────────
  // Embedded in the JWT at login time. If set, block all page navigation until
  // the user completes /change-password. Exempt /change-password itself to avoid a loop.
  if (payload?.mustChangePassword === true && !pathname.startsWith("/change-password")) {
    return NextResponse.redirect(new URL("/change-password", req.url));
  }

  // ── 1. Language gate ─────────────────────────────────────────────────────
  // Unauthenticated requests to any page outside the skip list must have
  // the "lang" cookie set (written by LanguageProvider on language selection).
  // If absent, redirect to / so the user goes through the language picker.
  // Authenticated users skip this gate — they already picked a language.
  const isSkipPath =
    SKIP_PATHS.has(pathname) ||
    pathname.startsWith("/journey") ||
    STATIC_EXT.test(pathname);
  if (!isSkipPath && !payload) {
    const langCookie = req.cookies.get("lang")?.value;
    if (!langCookie) {
      const originalPath = pathname + url.search;
      return NextResponse.redirect(
        new URL(`/?redirect=${encodeURIComponent(originalPath)}`, req.url)
      );
    }
  }

  // ── 2. Auth gate ─────────────────────────────────────────────────────────
  // Protects /self, /nation, /earth, /society.
  // Runs after the language gate so new users see the picker before the
  // login wall (language gate fires first for unauthenticated requests).
  if (!payload && PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete(COOKIE_NAME);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  // Exclude _next/ (static assets, image optimiser) and api/ routes.
  // All other paths, including /, /login, /register, go through the function
  // and are handled by the SKIP_PATHS / STATIC_EXT checks above.
  matcher: ["/((?!_next/|api/).*)", ],
};
