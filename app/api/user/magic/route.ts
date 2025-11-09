// app/api/user/magic/route.ts (debug-enabled)
import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/token";

function validateRedirect(candidate?: string | null): string | null {
  if (!candidate || typeof candidate !== "string") return null;
  if (!candidate.startsWith("/")) return null;
  if (candidate.startsWith("//")) return null;
  if (candidate.length > 2048) return null;
  try {
    const u = new URL(candidate, "http://example.invalid");
    return u.pathname + (u.search || "") + (u.hash || "");
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const debug = url.searchParams.get("debug") === "1";
  const rawRedirect = url.searchParams.get("redirect") || null;

  if (!token) {
    const target = `/login?error=missing-token`;
    if (debug) return NextResponse.json({ ok: false, reason: "missing-token", redirectTarget: target });
    return NextResponse.redirect(new URL(target, req.nextUrl.origin));
  }

  const tokenHash = hashToken(token);
  if (debug) console.log("[magic][debug] tokenHash:", tokenHash.slice(0, 8) + "...");

  try {
    const record = await prisma.magicLink.findFirst({
      where: {
        tokenHash,
        used: false,
        expiresAt: { gte: new Date() },
      },
      include: { user: true },
    });

    if (!record) {
      const target = `/login?error=invalid-or-expired`;
      if (debug) return NextResponse.json({ ok: false, reason: "invalid-or-expired", tokenHash, redirectRequested: rawRedirect });
      return NextResponse.redirect(new URL(target, req.nextUrl.origin));
    }

    // compute safe redirect
    const metaRedirect = record.meta && typeof record.meta === "object" ? (record.meta as any).redirect : null;
    const safeRedirect = validateRedirect(rawRedirect) || validateRedirect(metaRedirect) || "/";

    if (debug) {
      return NextResponse.json({
        ok: true,
        reason: "would-redirect-to-login",
        tokenHash,
        record: {
          id: record.id,
          used: record.used,
          expiresAt: record.expiresAt,
          userId: record.userId,
          meta: record.meta,
        },
        user: record.user ? { id: record.user.id, email: record.user.email } : null,
        requestedRedirect: rawRedirect,
        metaRedirect,
        safeRedirect,
        loginUrl: `/login?verified=1&email=${encodeURIComponent(record.user?.email || "")}&redirect=${encodeURIComponent(safeRedirect)}`,
      });
    }

    // Normal (non-debug) behavior: consume & mark used, verify user & redirect to login with redirect param
    await prisma.$transaction([
      prisma.magicLink.update({
        where: { id: record.id },
        data: { used: true, usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: { verified: true, emailVerified: true },
      }),
    ]);

    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("verified", "1");
    if (record.user?.email) loginUrl.searchParams.set("email", String(record.user.email));
    loginUrl.searchParams.set("redirect", safeRedirect);
    return NextResponse.redirect(loginUrl);
  } catch (err) {
    console.error("[magic] verify error:", err);
    if (debug) return NextResponse.json({ ok: false, reason: "server-error", error: String(err) });
    return NextResponse.redirect(new URL("/login?error=server-error", req.nextUrl.origin));
  }
}
