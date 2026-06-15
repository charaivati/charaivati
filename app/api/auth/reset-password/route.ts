// app/api/auth/reset-password/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/hash";
import { createSessionToken, setSessionCookie } from "@/lib/session";

// Must match an Otp row created+verified within this window — proves the
// caller recently completed POST /api/auth/otp/verify for this email.
const OTP_VERIFY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const newPassword = String(body.newPassword || "");

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: "missing_fields", message: "Email and new password are required" },
        { status: 400 }
      );
    }
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "weak_password", message: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Gate: a recently-verified OTP for this email must exist.
    const recentVerifiedOtp = await prisma.otp.findFirst({
      where: {
        target: email,
        targetType: "EMAIL",
        used: true,
        createdAt: { gte: new Date(Date.now() - OTP_VERIFY_WINDOW_MS) },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!recentVerifiedOtp) {
      return NextResponse.json(
        { error: "otp_required", message: "Please verify your email with an OTP first" },
        { status: 403 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: "user_not_found", message: "No account found for this email" },
        { status: 404 }
      );
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });

    // Single-use: prevent the same verified OTP from resetting the password again.
    await prisma.otp.delete({ where: { id: recentVerifiedOtp.id } }).catch(() => {});

    const token = await createSessionToken({
      userId: user.id,
      email: user.email ?? undefined,
    });

    const res = NextResponse.json({ ok: true });
    setSessionCookie(res, token);
    return res;
  } catch (err: any) {
    console.error("[reset-password] error:", err);
    return NextResponse.json({ error: "server_error", message: "Something went wrong" }, { status: 500 });
  }
}
