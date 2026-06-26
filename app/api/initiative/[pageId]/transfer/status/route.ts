import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

// GET /api/initiative/[pageId]/transfer/status — current transfer state for the owner
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;

  // Must be current owner OR fromUserId of a transfer for this page
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { ownerId: true },
  });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = page.ownerId === user.id;

  const transfer = await prisma.initiativeTransfer.findFirst({
    where: {
      pageId,
      fromUserId: user.id,
      status: { in: ["otp_pending", "awaiting_recipient"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      toEmail: true,
      otpExpiresAt: true,
      recipientExpiry: true,
      revokeDeadline: true,
    },
  });

  if (!transfer && !isOwner)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ transfer: transfer ?? null });
}
