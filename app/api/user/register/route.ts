// ============================================
// 1. app/api/user/register/route.ts (UPDATED)
// ============================================
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/hash";
import { createToken, hashToken } from "@/lib/token";
import sendEmail from "@/lib/sendEmail";

const MAGIC_EXPIRES_MS = 1000 * 60 * 15;
const RESEND_COOLDOWN_MS = 1000 * 60 * 1;

function sanitizeName(n: string) {
  return n
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\- _\.]/gu, "")
    .slice(0, 30);
}

function sanitizeRedirect(path: string) {
  if (!path || typeof path !== "string") return "/self";
  try {
    const u = new URL(path, "https://example.com");
    if (u.origin !== "https://example.com") return "/self";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/self";
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const rawName = String(body.name || "").trim();
    const redirect = String(body.redirect || "").trim(); // ← NEW

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const displayName = sanitizeName(rawName || (email.split("@")[0] || `user${Date.now()}`));
    if (displayName.length < 2) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        magicLinks: {
          where: { type: "verify-email" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (existingUser && existingUser.emailVerified) {
      return NextResponse.json(
        { error: "user_exists", message: "Account already exists — please log in or reset your password." },
        { status: 409 }
      );
    }

    const nameTaken = await prisma.user.findFirst({
      where: { name: { equals: displayName, mode: "insensitive" } },
      select: { id: true },
    });
    if (nameTaken) {
      return NextResponse.json({ error: "username_taken", message: "Username already taken" }, { status: 409 });
    }

    if (existingUser && !existingUser.emailVerified) {
      const latest = existingUser.magicLinks?.[0] ?? null;
      if (latest && !latest.used) {
        const now = Date.now();
        const expiresAt = new Date(latest.expiresAt).getTime();
        const createdAt = new Date(latest.createdAt).getTime();

        if (expiresAt > now) {
          const ageMs = now - createdAt;
          if (ageMs < RESEND_COOLDOWN_MS) {
            const retryAfter = Math.ceil((RESEND_COOLDOWN_MS - ageMs) / 1000);
            return NextResponse.json(
              {
                error: "verification_pending",
                message: "Verification already sent. Please check your email (including spam).",
                retryAfter,
              },
              { status: 409 }
            );
          }
        }
      }
    }

    let user;
    if (!existingUser) {
      const passwordHash = await hashPassword(password);
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          emailVerified: false,
          name: displayName,
          profile: { create: { displayName } },
        },
      });
    } else {
      const updateData: Record<string, any> = {};
      if (!existingUser.name) updateData.name = displayName;
      if (!existingUser.passwordHash) updateData.passwordHash = await hashPassword(password);
      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({ where: { id: existingUser.id }, data: updateData });
      } else {
        user = existingUser;
      }
    }

    const rawToken = createToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + MAGIC_EXPIRES_MS);
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown").split(",")[0].trim();

    // ← VALIDATE AND STORE REDIRECT
    const redirectPath = sanitizeRedirect(redirect);

    // Capture guest session so orders/cart survive email-link delay
    let guestId: string | undefined;
    try {
      const { getTokenFromRequest, verifySessionToken } = await import("@/lib/session");
      const guestToken = getTokenFromRequest(req);
      if (guestToken) {
        const payload = await verifySessionToken(guestToken);
        if (payload?.userId && payload.userId !== user.id) {
          const guestCheck = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: { status: true, email: true },
          });
          if (guestCheck?.status === "guest" && guestCheck.email === null) {
            guestId = payload.userId;
          }
        }
      }
    } catch {}

    await prisma.magicLink.create({
      data: {
        userId: user.id,
        tokenHash,
        type: "verify-email",
        expiresAt,
        ip,
        meta: { from: "register", redirect: redirectPath, ...(guestId ? { guestId } : {}) },
      },
    });

    const base = process.env.BASE_URL || `http://localhost:3000`;
    const link = `${base}/api/user/magic?token=${encodeURIComponent(rawToken)}&redirect=${encodeURIComponent(redirectPath)}`;
    
    if (process.env.NODE_ENV === "development" && (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.EMAIL_FROM)) {
      console.log("\n[register] ⚠️  Email not configured — verification link (dev only):\n" + link + "\n");
    }

    try {
      if (user.email) {
        await sendEmail({
          to: user.email,
          subject: "Verify your Charaivati account",
          text: `Verify your Charaivati account\n\nClick the link below to activate your account. This link expires in 15 minutes.\n\n${link}\n\nIf you didn't create a Charaivati account, ignore this email.`,
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
          <h1 style="margin:0;font-size:22px;font-weight:500;color:#18181b;">Verify your email</h1>
        </td></tr>
        <tr><td style="padding-bottom:28px;">
          <p style="margin:0;font-size:15px;line-height:1.6;color:#52525b;">Click the button below to activate your account. This link expires in 15 minutes.</p>
        </td></tr>
        <tr><td style="padding-bottom:20px;">
          <a href="${link}" style="display:inline-block;padding:13px 28px;background:#D85A30;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">Verify my account &rarr;</a>
        </td></tr>
        <tr><td style="padding-bottom:28px;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;word-break:break-all;">${link}</p>
        </td></tr>
        <tr><td style="border-top:1px solid #f4f4f5;padding-top:20px;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;">If you didn&apos;t create a Charaivati account, ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        });
      } else {
        console.warn("[register] user created without email; skipping email send");
      }
    } catch (e) {
      console.error("[register] sendEmail failed:", e);
      return NextResponse.json(
        { error: "email_send_failed", message: "Account created but verification email could not be sent. Contact support." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: "User created. Verification email sent.", name: user.name ?? displayName });
  } catch (err: any) {
    console.error("[register] error:", err);
    return NextResponse.json({ error: "server_error", detail: String(err) }, { status: 500 });
  }
}