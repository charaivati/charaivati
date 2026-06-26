import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { createNotification } from "@/lib/notifications/createNotification";
import crypto from "crypto";

// GET /api/initiative/transfer/accept?token=xxx — recipient accepts transfer via email link
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawToken = searchParams.get("token");
  if (!rawToken)
    return NextResponse.redirect(new URL("/earn", req.url));

  const user = await getServerUser(req);
  if (!user) {
    // Redirect to login; after login, user comes back here
    const thisPath = `/api/initiative/transfer/accept?token=${encodeURIComponent(rawToken)}`;
    return NextResponse.redirect(
      new URL(`/login?redirect=${encodeURIComponent(thisPath)}`, req.url)
    );
  }

  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const transfer = await prisma.initiativeTransfer.findFirst({
    where: { recipientToken: tokenHash, status: "awaiting_recipient" },
  });

  if (!transfer)
    return NextResponse.redirect(
      new URL("/earn?transfer_error=invalid_or_expired", req.url)
    );

  if (!transfer.recipientExpiry || transfer.recipientExpiry < new Date())
    return NextResponse.redirect(
      new URL("/earn?transfer_error=link_expired", req.url)
    );

  // Verify the logged-in user is the intended recipient
  if (transfer.toUserId && transfer.toUserId !== user.id)
    return NextResponse.redirect(
      new URL("/earn?transfer_error=wrong_account", req.url)
    );

  const page = await prisma.page.findUnique({
    where: { id: transfer.pageId },
    select: { title: true },
  });

  const revokeDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.page.update({
      where: { id: transfer.pageId },
      data: { ownerId: user.id },
    }),
    prisma.initiativeTransfer.update({
      where: { id: transfer.id },
      data: {
        toUserId: user.id,
        status: "completed",
        completedAt: new Date(),
        revokeDeadline,
        recipientToken: null, // invalidate the one-time token
      },
    }),
  ]);

  // Notify both parties (fire-and-forget)
  createNotification({
    userId: transfer.fromUserId,
    type: "transfer_completed",
    title: "Ownership transferred",
    body: `"${page?.title}" is now owned by ${user.name ?? user.email}. You can revoke until ${revokeDeadline.toLocaleDateString()}.`,
    link: "/app/initiatives",
  }).catch(console.error);

  createNotification({
    userId: user.id,
    type: "transfer_completed",
    title: "Initiative received",
    body: `You are now the owner of "${page?.title}".`,
    link: `/earn/initiative/${transfer.pageId}`,
  }).catch(console.error);

  return NextResponse.redirect(
    new URL(`/earn/initiative/${transfer.pageId}`, req.url)
  );
}
