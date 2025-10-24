// app/api/user/magic/route.ts
import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/token";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      console.log("[magic] no token param");
      return NextResponse.redirect(new URL("/login?error=missing-token", req.nextUrl.origin));
    }

    const tokenHash = hashToken(token);
    console.log("[magic] verifying tokenHash:", tokenHash.slice(0, 8) + "...");

    // Find the magic link (unused + not expired)
    const record = await prisma.magicLink.findFirst({
      where: {
        tokenHash,
        used: false,
        expiresAt: { gte: new Date() },
      },
      include: { user: true },
    });

    if (!record) {
      console.log("[magic] token invalid or expired");
      return NextResponse.redirect(new URL("/login?error=invalid-or-expired", req.nextUrl.origin));
    }

    // ✅ Transaction: mark link used & user verified
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

    console.log("[magic] magic link consumed; user marked verified:", record.userId);

    // ✅ Redirect user to login page with success flag
    return NextResponse.redirect(new URL("/login?verified=1", req.nextUrl.origin));
  } catch (err) {
    console.error("[magic] verify error:", err);
    return NextResponse.redirect(new URL("/login?error=server-error", new URL(req.url).origin));
  }
}
