// app/api/auth/otp/verify/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

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

    // ✅ mark as used (only valid field is 'used')
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    // return linked user if exists
    const user = await prisma.user.findFirst({
      where: targetType === "phone" ? { phone: target } : { email: target },
      select: { id: true, email: true, phone: true },
    });

    return NextResponse.json({ ok: true, user: user ?? null });
  } catch (err: any) {
    console.error("OTP verify error:", err);
    return NextResponse.json({ error: err?.message ?? "internal" }, { status: 500 });
  }
}
