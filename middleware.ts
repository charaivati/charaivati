import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";

const PROTECTED_ROUTES = [
  "/self",
  "/nation",
  "/earth",
  "/society",
];

export async function middleware(req: NextRequest) {

  const url = new URL(req.url);

  const needsAuth = PROTECTED_ROUTES.some((route) =>
    url.pathname.startsWith(route)
  );

  if (!needsAuth) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;

  const payload = await verifySessionToken(token);

  if (!payload) {
    const res = NextResponse.redirect(
      new URL("/login", req.url)
    );

    res.cookies.delete(COOKIE_NAME);

    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};