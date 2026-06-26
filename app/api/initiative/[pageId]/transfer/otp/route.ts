import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import sendEmail from "@/lib/sendEmail";
import { absoluteUrl } from "@/lib/config";
import crypto from "crypto";

// POST /api/initiative/[pageId]/transfer/otp — verify OTP, send recipient confirmation email
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;
  const { code } = await req.json();
  if (!code || typeof code !== "string")
    return NextResponse.json({ error: "code required" }, { status: 400 });

  const transfer = await prisma.initiativeTransfer.findFirst({
    where: { pageId, fromUserId: user.id, status: "otp_pending" },
    orderBy: { createdAt: "desc" },
  });

  if (!transfer)
    return NextResponse.json({ error: "No pending transfer found" }, { status: 404 });

  if (!transfer.otpExpiresAt || transfer.otpExpiresAt < new Date())
    return NextResponse.json({ error: "Code expired. Start a new transfer." }, { status: 400 });

  if (transfer.otpAttempts >= 5)
    return NextResponse.json({ error: "Too many attempts. Start a new transfer." }, { status: 429 });

  // Verify OTP
  const salt = Buffer.from(transfer.otpSalt ?? "", "hex");
  const computed = crypto.scryptSync(code, salt, 64).toString("hex");
  if (computed !== transfer.otpHash) {
    await prisma.initiativeTransfer.update({
      where: { id: transfer.id },
      data: { otpAttempts: { increment: 1 } },
    });
    return NextResponse.json({ error: "Incorrect code" }, { status: 400 });
  }

  // Look up recipient — must have an existing account (MVP)
  const recipient = await prisma.user.findFirst({
    where: { email: transfer.toEmail },
    select: { id: true, name: true, email: true },
  });
  if (!recipient)
    return NextResponse.json(
      { error: "No account found for that email. Ask them to register first." },
      { status: 404 }
    );

  // Look up page title for the email
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { title: true },
  });

  // Generate recipient token
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const recipientExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const updated = await prisma.initiativeTransfer.update({
    where: { id: transfer.id },
    data: {
      toUserId: recipient.id,
      status: "awaiting_recipient",
      recipientToken: tokenHash,
      recipientExpiry,
      // clear OTP fields
      otpHash: null,
      otpSalt: null,
      otpExpiresAt: null,
    },
  });

  const acceptUrl = absoluteUrl(`/api/initiative/transfer/accept?token=${rawToken}`);

  try {
    await sendEmail({
      to: transfer.toEmail,
      subject: `You've been offered ownership of "${page?.title}"`,
      text: `${user.name ?? "Someone"} wants to transfer their initiative "${page?.title}" to you on Charaivati.\n\nAccept the transfer here (expires in 48 hours):\n${acceptUrl}\n\nIf you don't want this, simply ignore this email.`,
      html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#f4f4f5;padding:32px 16px;">
<table width="100%" style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e4e4e7;">
<tr><td style="padding-bottom:16px;"><h2 style="margin:0;font-size:20px;color:#18181b;">Initiative ownership offer</h2></td></tr>
<tr><td style="padding-bottom:20px;color:#52525b;font-size:14px;line-height:1.6;">
  <strong>${user.name ?? "A Charaivati user"}</strong> wants to transfer ownership of <strong>${page?.title}</strong> to your account.
  This link expires in <strong>48 hours</strong>.
</td></tr>
<tr><td style="padding-bottom:24px;text-align:center;">
  <a href="${acceptUrl}" style="display:inline-block;padding:12px 28px;background:#534AB7;color:#fff;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">Accept Ownership</a>
</td></tr>
<tr><td style="color:#a1a1aa;font-size:12px;">If you don't want this, simply ignore this email. No action required to decline.</td></tr>
</table></body></html>`,
    });
  } catch (e) {
    console.error("[transfer/otp] sendEmail to recipient failed:", e);
    if (process.env.NODE_ENV === "development") {
      console.log(`\n[transfer] Accept URL (dev — email not configured): ${acceptUrl}\n`);
    }
    await prisma.initiativeTransfer.update({
      where: { id: transfer.id },
      data: { status: "cancelled" },
    });
    return NextResponse.json(
      { error: "Could not send invitation email. Contact support." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    transfer: {
      id: updated.id,
      status: updated.status,
      toEmail: updated.toEmail,
      recipientExpiry: updated.recipientExpiry,
    },
  });
}
