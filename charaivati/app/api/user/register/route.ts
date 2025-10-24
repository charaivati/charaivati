// app/api/user/register/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/hash";
import { createToken, hashToken } from "@/lib/token";
import sendEmail from "@/lib/sendEmail";

/**
 * Config
 */
const MAGIC_EXPIRES_MS = 1000 * 60 * 15; // 15 minutes
const RESEND_COOLDOWN_MS = 1000 * 60 * 1; // 1 minute cooldown to avoid spam

function sanitizeName(n: string) {
  return n
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\- _\.]/gu, "")
    .slice(0, 30);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const rawName = String(body.name || "").trim();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const displayName = sanitizeName(rawName || (email.split("@")[0] || `user${Date.now()}`));
    if (displayName.length < 2) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    // 1) Find existing user by email (and include recent magic links)
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

    // 2) If user exists and already verified => instruct to login/reset
    if (existingUser && existingUser.emailVerified) {
      return NextResponse.json(
        { error: "user_exists", message: "Account already exists — please log in or reset your password." },
        { status: 409 }
      );
    }

    // 3) Username uniqueness (case-insensitive)
    const nameTaken = await prisma.user.findFirst({
      where: { name: { equals: displayName, mode: "insensitive" } },
      select: { id: true },
    });
    if (nameTaken) {
      return NextResponse.json({ error: "username_taken", message: "Username already taken" }, { status: 409 });
    }

    // 4) If user exists and unverified: check for outstanding magic link
    if (existingUser && !existingUser.emailVerified) {
      const latest = existingUser.magicLinks?.[0] ?? null;
      if (latest && !latest.used) {
        const now = Date.now();
        const expiresAt = new Date(latest.expiresAt).getTime();
        const createdAt = new Date(latest.createdAt).getTime();

        if (expiresAt > now) {
          // still valid token exists
          const ageMs = now - createdAt;
          if (ageMs < RESEND_COOLDOWN_MS) {
            // too soon to resend - inform front-end to show friendly message
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
          // else: token is still valid but cooldown passed -> allow generating a new one below
        }
      }
    }

    // 5) Create or update user
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
      // existing unverified user: update missing fields (do not overwrite verified flags)
      const updateData: Record<string, any> = {};
      if (!existingUser.name) updateData.name = displayName;
      // update passwordHash if not present (so user can log in later)
      if (!existingUser.passwordHash) updateData.passwordHash = await hashPassword(password);
      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({ where: { id: existingUser.id }, data: updateData });
      } else {
        user = existingUser;
      }
    }

    // 6) Create new magic link (raw token + hash) and store
    const rawToken = createToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + MAGIC_EXPIRES_MS);
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown").split(",")[0].trim();

    await prisma.magicLink.create({
      data: {
        userId: user.id,
        tokenHash,
        type: "verify-email",
        expiresAt,
        ip,
        meta: { from: "register" },
      },
    });

    // 7) Send verification email (best effort)
    const base = process.env.BASE_URL || `http://localhost:3000`;
    const link = `${base}/api/user/magic?token=${encodeURIComponent(rawToken)}&redirect=${encodeURIComponent("/login")}`;
    try {
      if (user.email) {
        await sendEmail({
          to: user.email,
          subject: "Verify your email",
          text: `Click this link to verify your account: ${link}\nThis link expires in 15 minutes.`,
          html: `<p>Click this link to verify your account:</p><p><a href="${link}">${link}</a></p><p>This link expires in 15 minutes.</p>`,
        });
      } else {
        console.warn("[register] user created without email; skipping email send");
      }
    } catch (e) {
      console.error("[register] sendEmail failed:", e);
      // respond success (so UX isn't blocked) but include note for dev
      return NextResponse.json({ ok: true, note: "email_send_failed", name: user.name ?? displayName }, { status: 200 });
    }

    return NextResponse.json({ ok: true, message: "User created. Verification email sent.", name: user.name ?? displayName });
  } catch (err: any) {
    console.error("[register] error:", err);
    return NextResponse.json({ error: "server_error", detail: String(err) }, { status: 500 });
  }
}
