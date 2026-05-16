// app/api/auth/otp/verify/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { createSessionToken, setSessionCookie } from "@/lib/session";

function hashWithSalt(code: string, saltHex: string) {
  const salt = Buffer.from(saltHex, "hex");
  const derived = crypto.scryptSync(code, salt, 64);
  return derived.toString("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { target, targetType, code } = body;
    if (!target || !targetType || !code) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    // find latest unused, unexpired OTP for this target
    const otpRecord = await prisma.otp.findFirst({
      where: { target, targetType, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      return NextResponse.json({ error: "no valid otp found" }, { status: 400 });
    }

    const computed = hashWithSalt(code, otpRecord.codeSalt ?? "");
    if (computed !== otpRecord.codeHash) {
      await prisma.otp.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      return NextResponse.json({ error: "invalid code" }, { status: 400 });
    }

    // ✅ mark as used
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    if (targetType === "PHONE") {
      // find or create user by phone number
      let user = await prisma.user.findFirst({
        where: { phone: target },
        select: { id: true, phone: true },
      });

      if (!user) {
        const last4 = target.replace(/\D/g, "").slice(-4);
        user = await prisma.user.create({
          data: {
            phone: target,
            name: `User${last4}`,
            status: "active",
          },
          select: { id: true, phone: true },
        });
      }

      const token = await createSessionToken({ userId: user.id });
      const res = NextResponse.json({ ok: true });
      setSessionCookie(res, token);
      return res;
    }

    // Non-PHONE: return linked user (existing behaviour)
    const user = await prisma.user.findFirst({
      where: { email: target },
      select: { id: true, email: true, phone: true },
    });

    return NextResponse.json({ ok: true, user: user ?? null });
  } catch (err: any) {
    console.error("OTP verify error:", err);
    return NextResponse.json({ error: err?.message ?? "internal" }, { status: 500 });
  }
}
