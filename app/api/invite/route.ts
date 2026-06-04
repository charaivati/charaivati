// app/api/invite/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { createToken, hashToken } from "@/lib/token";
import { checkRateLimit } from "@/lib/rateLimit";
import sendEmail from "@/lib/sendEmail";

// 7-day TTL — invite links must survive a full workday; 15-min verification TTL is impractical here
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

export async function POST(req: Request) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const inviter = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, email: true, status: true },
  });
  if (!inviter || (inviter.status !== "active" && inviter.status !== "lite")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawEmail = String(body.email || "").trim().toLowerCase();
  if (!rawEmail || !rawEmail.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  // Rate limit: max 10 invites per inviter per 24h
  const rl = await checkRateLimit(`invite:${inviter.id}`, 10, 86400);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "You've reached the invite limit for today. Try again tomorrow." },
      { status: 429 }
    );
  }

  // Always return the same generic message — no enumeration
  const GENERIC_REPLY = NextResponse.json({
    ok: true,
    message: "If they're not already on Charaivati, they'll get an email to join.",
  });

  const existing = await db.user.findUnique({
    where: { email: rawEmail },
    select: { id: true, status: true, emailVerified: true },
  });

  if (existing && (existing.emailVerified || existing.status === "active" || existing.status === "lite")) {
    // Email is already registered — send a silent security notice, no invite
    await sendSecurityNotice(rawEmail, inviter.name ?? "Someone").catch((e) =>
      console.error("[invite] security notice failed:", e)
    );
    // Log the attempt as potential abuse metadata
    console.warn("[invite] invite attempted for existing account", {
      inviterId: inviter.id,
      targetEmail: rawEmail,
      at: new Date().toISOString(),
    });
    return GENERIC_REPLY;
  }

  // Normalise invite tokens — one active invite per (inviterId, email) is enough
  // Revoke any pending invite from this inviter to this email so we don't pile up rows
  await (db as any).invite.updateMany({
    where: { inviterId: inviter.id, email: rawEmail, status: "pending" },
    data: { status: "revoked" },
  });

  // Create or reuse the shell user for this email
  let shellUser = existing; // could be an unverified guest/invited shell
  if (!shellUser) {
    shellUser = await db.user.create({
      data: {
        email: rawEmail,
        status: "invited",
        emailVerified: false,
        contactVerified: false,
      },
      select: { id: true, status: true, emailVerified: true },
    });
  }

  const rawToken = createToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await (db as any).invite.create({
    data: {
      tokenHash,
      email: rawEmail,
      inviterId: inviter.id,
      shellUserId: shellUser.id,
      expiresAt,
    },
  });

  const claimUrl = `${BASE_URL}/claim/${encodeURIComponent(rawToken)}`;
  const inviterName = inviter.name ?? "A friend";

  await sendEmail({
    to: rawEmail,
    subject: `${inviterName} invited you to Charaivati`,
    text: `${inviterName} has invited you to join Charaivati — a platform for personal growth, community action, and economic participation.\n\nClick the link below to join (expires in 7 days):\n\n${claimUrl}\n\nIf you weren't expecting this, you can safely ignore it.`,
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
          <h1 style="margin:0;font-size:22px;font-weight:500;color:#18181b;">You're invited</h1>
        </td></tr>
        <tr><td style="padding-bottom:28px;">
          <p style="margin:0;font-size:15px;line-height:1.6;color:#52525b;">
            <strong>${inviterName}</strong> has invited you to join Charaivati — a platform for personal growth, community action, and economic participation.
          </p>
        </td></tr>
        <tr><td style="padding-bottom:20px;">
          <a href="${claimUrl}" style="display:inline-block;padding:13px 28px;background:#D85A30;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">Join Charaivati &rarr;</a>
        </td></tr>
        <tr><td style="padding-bottom:28px;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;word-break:break-all;">${claimUrl}</p>
        </td></tr>
        <tr><td style="border-top:1px solid #f4f4f5;padding-top:20px;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;">This link expires in 7 days. If you weren't expecting this invitation, you can safely ignore it.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });

  if (process.env.NODE_ENV === "development") {
    console.log(`[invite] claim link (dev): ${claimUrl}`);
  }

  return GENERIC_REPLY;
}

async function sendSecurityNotice(to: string, inviterName: string) {
  await sendEmail({
    to,
    subject: "Someone tried to invite your Charaivati account",
    text: `Someone tried to invite this email address (${to}) to Charaivati, but you already have an account.\n\nNo action was taken. If this wasn't expected, you can safely ignore this message.`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e4e4e7;">
        <tr><td style="padding-bottom:24px;text-align:center;">
          <span style="font-size:13px;color:#71717a;letter-spacing:0.04em;">चरैवेति &middot; Charaivati</span>
        </td></tr>
        <tr><td style="padding-bottom:8px;">
          <h1 style="margin:0;font-size:20px;font-weight:500;color:#18181b;">Invite attempt notice</h1>
        </td></tr>
        <tr><td style="padding-bottom:28px;">
          <p style="margin:0;font-size:15px;line-height:1.6;color:#52525b;">
            Someone tried to invite this email address to Charaivati, but you already have an account. No action was taken — if this wasn't expected, you can safely ignore it.
          </p>
        </td></tr>
        <tr><td style="border-top:1px solid #f4f4f5;padding-top:20px;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;">This is an automated security notice from Charaivati.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
