// app/api/user/resend-verification/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMagicToken } from "@/lib/auth";
import { hashToken } from "@/lib/token";
import sendEmail from "@/lib/sendEmail";
import { checkRateLimit } from "@/lib/rateLimit"; // you had something like this

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "email_required" }, { status: 400 });

    // Basic rate limiting keys
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const ipKey = `resend:ip:${ip}`;
    const emailKey = `resend:email:${email}`;

    const ipOk = await checkRateLimit(ipKey, 20, 3600); // e.g. 20 req/hr per IP
    if (!ipOk.ok) return NextResponse.json({ error: "too_many_requests_ip" }, { status: 429 });

    const emailOk = await checkRateLimit(emailKey, 3, 3600); // 3 per hour per email
    if (!emailOk.ok) return NextResponse.json({ error: "too_many_requests_email" }, { status: 429 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

    if (user.emailVerified) {
      return NextResponse.json({ error: "already_verified", message: "This account is already verified. Please login or reset password." }, { status: 409 });
    }

    // Look for latest unused magic link for verify-email
    const recent = await prisma.magicLink.findFirst({
      where: { userId: user.id, type: "verify-email", used: false },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    if (recent && recent.expiresAt && recent.expiresAt > now) {
      // still valid — ask user to check email
      return NextResponse.json({
        ok: true,
        reason: "already_sent",
        message: "A verification link has already been sent. Please check your inbox or spam folder.",
      }, { status: 200 });
    }

    // Create new token (raw token + hashed stored)
    const rawToken = createMagicToken(user.id); // if this returns raw token; if not, use createToken() + hashToken
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

    await prisma.magicLink.create({
      data: {
        userId: user.id,
        tokenHash,
        type: "verify-email",
        expiresAt,
        ip,
      },
    });

    const base = process.env.BASE_URL || "http://localhost:3000";
    const link = `${base}/api/user/magic?token=${encodeURIComponent(rawToken)}&redirect=${encodeURIComponent("/login")}`;

    try {
      await sendEmail({
        to: user.email!,
        subject: "Verify your email",
        text: `Click this link to verify your account: ${link}`,
        html: `<p>Click this link to verify your account:</p><p><a href="${link}">${link}</a></p><p>This link expires in 15 minutes.</p>`,
      });
    } catch (e) {
      console.error("resend verification email failed:", e);
      return NextResponse.json({ ok: false, error: "email_send_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, reason: "resent", message: "Verification email sent." }, { status: 200 });
  } catch (err) {
    console.error("resend error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
