// app/api/auth/otp/request/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendSMS } from "@/lib/sms";
import sendEmail from "@/lib/sendEmail";

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

    if (targetType === "PHONE") {
      await sendSMS(target, code);
    }

    if (targetType === "EMAIL") {
      if (process.env.NODE_ENV === "development" && (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.EMAIL_FROM)) {
        console.log(`\n[otp/request] ⚠️  Email not configured — OTP code (dev only): ${code}\n`);
      }

      try {
        await sendEmail({
          to: target,
          subject: "Your Charaivati verification code",
          text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, ignore this email.`,
          html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e4e4e7;">
        <tr><td style="padding-bottom:24px;text-align:center;">
          <span style="font-size:13px;color:#71717a;letter-spacing:0.04em;">चरैवेति &middot; Charaivati</span>
        </td></tr>
        <tr><td style="padding-bottom:8px;">
          <h1 style="margin:0;font-size:22px;font-weight:500;color:#18181b;">Your verification code</h1>
        </td></tr>
        <tr><td style="padding-bottom:28px;">
          <p style="margin:0;font-size:15px;line-height:1.6;color:#52525b;">Enter this code to continue. It expires in 10 minutes.</p>
        </td></tr>
        <tr><td style="padding-bottom:28px;text-align:center;">
          <span style="display:inline-block;padding:13px 28px;background:#D85A30;color:#ffffff;border-radius:8px;font-size:24px;font-weight:700;letter-spacing:0.1em;">${code}</span>
        </td></tr>
        <tr><td style="border-top:1px solid #f4f4f5;padding-top:20px;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;">If you didn&apos;t request this, ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        });
      } catch (e) {
        console.error("[otp/request] sendEmail failed:", e);
        return NextResponse.json(
          { error: "email_send_failed", message: "Could not send OTP email. Please try again." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true, id: otp.id });
  } catch (err: any) {
    console.error("OTP request error:", err);
    return NextResponse.json({ error: err?.message ?? "internal" }, { status: 500 });
  }
}
