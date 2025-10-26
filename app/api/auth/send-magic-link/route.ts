// app/api/auth/send-magic-link/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createToken, hashToken } from "@/lib/token";
import sendEmail from "@/lib/sendEmail";
import sendSms from "@/lib/sendSms";
import { checkRateLimit } from "@/lib/rateLimit";
import { absoluteUrl } from "@/lib/config"; // uses NEXT_PUBLIC_SITE_URL in prod

type Body = {
  email?: string;
  phone?: string;
  purpose?: "verify-email" | "magic-login" | "verify-phone";
  redirectTo?: string;
};

function extractIp(req: Request) {
  // prefer x-forwarded-for (might contain "client, proxy1, proxy2")
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export async function POST(req: Request) {
  // Parse JSON body safely
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ip = extractIp(req);
  const purpose = body.purpose || "verify-email";
  const redirectTo = body.redirectTo || "/";

  if (!body.email && !body.phone) {
    return NextResponse.json({ error: "Provide email or phone" }, { status: 400 });
  }

  // simple rate limiting per IP and per destination
  const ipKey = `send:${purpose}:ip:${ip}`;
  const targetKey = body.email
    ? `send:${purpose}:email:${body.email}`
    : `send:${purpose}:phone:${body.phone}`;

  try {
    const ipCheck = await checkRateLimit(ipKey, 10, 3600); // max 10 per hour per IP
    if (!ipCheck.ok)
      return NextResponse.json({ error: "Too many requests from IP" }, { status: 429 });

    const targetCheck = await checkRateLimit(targetKey, 3, 3600); // max 3 per hour per email/phone
    if (!targetCheck.ok)
      return NextResponse.json(
        { error: "Too many requests for this recipient" },
        { status: 429 }
      );
  } catch (err) {
    // rate limiter backend failure — don't leak details to user
    console.warn("Rate limiter backend error");
    // allow or deny? conservative approach: block when rate limiter fails
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // find or create user (upsert by unique field)
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
    console.error("DB upsert error (send-magic-link)");
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!user) return NextResponse.json({ error: "Unable to get user" }, { status: 500 });

  // create token + store hashed
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
    console.error("DB create magic link error");
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // Build canonical verify URL using absoluteUrl helper
  // Note: use the same route your app uses to verify (here: /auth/verify)
  const verifyPath = "/auth/verify";
  const verifyBase = absoluteUrl(verifyPath);
  const verifyUrl = `${verifyBase}?token=${encodeURIComponent(
    rawToken
  )}&type=${encodeURIComponent(purpose)}&redirect=${encodeURIComponent(redirectTo)}`;

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
    console.error("Send failed (send-magic-link)", (err as any)?.message || err);
    return NextResponse.json({ error: "Failed to send link" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
