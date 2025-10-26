// app/api/auth/send-magic-link/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createToken, hashToken } from "@/lib/token";
import sendEmail from "@/lib/sendEmail";
import sendSms from "@/lib/sendSms";
import { checkRateLimit } from "@/lib/rateLimit";
import { absoluteUrl } from "@/lib/config";

type Body = {
  email?: string;
  phone?: string;
  purpose?: "verify-email" | "magic-login" | "verify-phone";
  redirectTo?: string;
};

function extractIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ip = extractIp(req);
  const purpose = body.purpose || "verify-email";
  const redirectTo = body.redirectTo || "/";

  if (!body.email && !body.phone) {
    return NextResponse.json({ error: "Provide email or phone" }, { status: 400 });
  }

  // ---------------- Rate Limiting ----------------
  const ipKey = `send:${purpose}:ip:${ip}`;
  const targetKey = body.email
    ? `send:${purpose}:email:${body.email}`
    : `send:${purpose}:phone:${body.phone}`;

  try {
    const ipCheck = await checkRateLimit(ipKey, 10, 3600);
    if (!ipCheck.ok)
      return NextResponse.json({ error: "Too many requests from IP" }, { status: 429 });

    const targetCheck = await checkRateLimit(targetKey, 3, 3600);
    if (!targetCheck.ok)
      return NextResponse.json(
        { error: "Too many requests for this recipient" },
        { status: 429 }
      );
  } catch {
    console.warn("Rate limiter backend error");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // ---------------- User Upsert ----------------
  let user;
  try {
    if (body.email) {
      user = await prisma.user.upsert({
        where: { email: body.email },
        update: {},
        create: { email: body.email },
      });
    } else if (body.phone) {
      user = await prisma.user.upsert({
        where: { phone: body.phone },
        update: {},
        create: { phone: body.phone },
      });
    }
  } catch (err) {
    console.error("DB upsert error (send-magic-link)", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!user) return NextResponse.json({ error: "Unable to get user" }, { status: 500 });

  // ---------------- Token Creation ----------------
  const rawToken = createToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

  try {
    await prisma.magicLink.create({
      data: {
        userId: user.id,
        tokenHash,
        type: purpose,
        expiresAt,
        ip,
        meta: { redirectTo },
      },
    });
  } catch (err) {
    console.error("DB create magic link error", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const verifyPath = "/auth/verify";
  const verifyBase = absoluteUrl(verifyPath);
  const verifyUrl = `${verifyBase}?token=${encodeURIComponent(
    rawToken
  )}&type=${encodeURIComponent(purpose)}&redirect=${encodeURIComponent(redirectTo)}`;

  // ---------------- Send Email or SMS ----------------
  try {
    if (body.email) {
      await sendEmail({
        to: body.email!,
        subject: "Your magic sign-in link",
        text: `Click this link to continue: ${verifyUrl}\n\nThis link expires in 15 minutes.`,
        html: `<p>Click this link to continue: <a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 15 minutes.</p>`,
      });
    } else if (body.phone) {
      await sendSms({
        to: body.phone!,
        body: `Sign in: ${verifyUrl} (expires in 15 min)`,
      });
    }
  } catch (err) {
    const msg = (err as any)?.message || "";
    console.error("Send failed (send-magic-link)", msg);
    if (msg.includes("not configured") || msg.includes("TWILIO")) {
      return NextResponse.json({ error: "SMS provider not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to send link" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
