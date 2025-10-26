// app/api/user/verify/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import jwt from "jsonwebtoken";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawToken = url.searchParams.get("token");
    const email = url.searchParams.get("email");
    const redirectPath = url.searchParams.get("redirect") || "/user";

    if (!rawToken || !email) {
      return NextResponse.json({ error: "Invalid verification link" }, { status: 400 });
    }

    const tokenHash = hashToken(rawToken);

    // find token record
    const record = await prisma.verificationToken.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!record || record.expires < new Date()) {
      return NextResponse.json({ error: "Token expired or invalid" }, { status: 400 });
    }

    const user = record.user;
    if (!user) {
      return NextResponse.json({ error: "User not found for token" }, { status: 400 });
    }

    // mark user verified
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verified: true },
    });

    // delete token so it can't be reused
    await prisma.verificationToken.delete({
      where: { token: tokenHash },
    });

    // create JWT session
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error("JWT_SECRET not set in .env");
      // still redirect but without setting cookie
      const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const redirectUrl = new URL(redirectPath, base);
      return NextResponse.redirect(redirectUrl.toString());
    }

    const payload = { sub: user.id, email: user.email };
    // choose expiry you want, e.g., 7 days
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

    // Build absolute redirect URL
    const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const redirectUrl = new URL(redirectPath, base);

    // Set cookie on response
    const res = NextResponse.redirect(redirectUrl.toString());
    // maxAge in seconds (7 days)
    const maxAge = 60 * 60 * 24 * 7;

    // Use secure: true in production (HTTPS). For local dev, secure must be false.
    res.cookies.set("session", token, {
      httpOnly: true,
      path: "/",
      maxAge,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return res;
  } catch (err: any) {
    console.error("Verify error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
