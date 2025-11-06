// app/api/auth/otp/request/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function hashWithSalt(code: string, salt: Buffer) {
  const derived = crypto.scryptSync(code, salt, 64);
  return derived.toString("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { target, targetType } = body;
    if (!target || !targetType) {
      return NextResponse.json({ error: "missing target or targetType" }, { status: 400 });
    }

    // 6-digit code
    const code = (Math.floor(100000 + Math.random() * 900000)).toString();
    const salt = crypto.randomBytes(16);
    const codeHash = hashWithSalt(code, salt);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // NOTE: 'otp' is the correct model client name (lowercase)
    const otp = await prisma.otp.create({
      data: {
        target,
        targetType,
        codeHash,
        codeSalt: salt.toString("hex"),
        expiresAt,
      },
    });

    // For dev convenience: return code in non-production
    const devPayload = process.env.NODE_ENV !== "production" ? { devCode: code } : {};

    return NextResponse.json({ ok: true, id: otp.id, ...devPayload });
  } catch (err: any) {
    console.error("OTP request error:", err);
    return NextResponse.json({ error: err?.message ?? "internal" }, { status: 500 });
  }
}
