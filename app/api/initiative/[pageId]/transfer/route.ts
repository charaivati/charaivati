import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import sendEmail from "@/lib/sendEmail";
import crypto from "crypto";

function hashOtp(code: string, salt: Buffer) {
  return crypto.scryptSync(code, salt, 64).toString("hex");
}

// POST /api/initiative/[pageId]/transfer — initiate transfer, send OTP to owner
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { ownerId: true, title: true, deletedAt: true },
  });
  if (!page || page.ownerId !== user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (page.deletedAt)
    return NextResponse.json({ error: "Page is deleted" }, { status: 409 });

  const { toEmail } = await req.json();
  if (!toEmail || typeof toEmail !== "string")
    return NextResponse.json({ error: "toEmail required" }, { status: 400 });
  if (toEmail.toLowerCase() === user.email?.toLowerCase())
    return NextResponse.json({ error: "You cannot transfer to yourself" }, { status: 400 });

  // Cancel any existing non-terminal transfer for this page
  await prisma.initiativeTransfer.updateMany({
    where: { pageId, status: { in: ["otp_pending", "awaiting_recipient"] } },
    data: { status: "cancelled" },
  });

  // Generate OTP
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const salt = crypto.randomBytes(16);
  const otpHash = hashOtp(code, salt);
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const transfer = await prisma.initiativeTransfer.create({
    data: {
      pageId,
      fromUserId: user.id,
      toEmail: toEmail.toLowerCase().trim(),
      status: "otp_pending",
      otpHash,
      otpSalt: salt.toString("hex"),
      otpExpiresAt,
    },
  });

  if (
    process.env.NODE_ENV === "development" &&
    (!process.env.EMAIL_USER || !process.env.EMAIL_PASS)
  ) {
    console.log(`\n[transfer] OTP (dev only): ${code}\n`);
  }

  try {
    await sendEmail({
      to: user.email!,
      subject: `Confirm transfer of "${page.title}"`,
      text: `Your transfer confirmation code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not request this transfer, ignore this email.`,
      html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#f4f4f5;padding:32px 16px;">
<table width="100%" style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e4e4e7;">
<tr><td style="padding-bottom:16px;"><h2 style="margin:0;font-size:20px;color:#18181b;">Confirm initiative transfer</h2></td></tr>
<tr><td style="padding-bottom:12px;color:#52525b;font-size:14px;">You are transferring <strong>${page.title}</strong> to <strong>${toEmail}</strong>. Enter this code to confirm:</td></tr>
<tr><td style="padding-bottom:24px;text-align:center;">
  <span style="display:inline-block;padding:12px 28px;background:#D85A30;color:#fff;border-radius:8px;font-size:28px;font-weight:700;letter-spacing:0.15em;">${code}</span>
</td></tr>
<tr><td style="color:#a1a1aa;font-size:12px;">Expires in 10 minutes. If you didn't request this, ignore this email.</td></tr>
</table></body></html>`,
    });
  } catch (e) {
    console.error("[transfer] sendEmail failed:", e);
    await prisma.initiativeTransfer.delete({ where: { id: transfer.id } });
    return NextResponse.json({ error: "email_send_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    transfer: {
      id: transfer.id,
      status: transfer.status,
      toEmail: transfer.toEmail,
      otpExpiresAt: transfer.otpExpiresAt,
    },
  });
}

// DELETE /api/initiative/[pageId]/transfer — cancel pending transfer
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;

  const updated = await prisma.initiativeTransfer.updateMany({
    where: {
      pageId,
      fromUserId: user.id,
      status: { in: ["otp_pending", "awaiting_recipient"] },
    },
    data: { status: "cancelled" },
  });

  if (updated.count === 0)
    return NextResponse.json({ error: "No active transfer found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
