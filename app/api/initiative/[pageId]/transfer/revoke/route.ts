import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { createNotification } from "@/lib/notifications/createNotification";

// POST /api/initiative/[pageId]/transfer/revoke — original owner reclaims within 7 days
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;

  const transfer = await prisma.initiativeTransfer.findFirst({
    where: {
      pageId,
      fromUserId: user.id,
      status: "completed",
      revokeDeadline: { gt: new Date() },
    },
    orderBy: { completedAt: "desc" },
  });

  if (!transfer)
    return NextResponse.json(
      { error: "No revokable transfer found. The revoke window may have expired." },
      { status: 404 }
    );

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { title: true },
  });

  // Flip ownership back and mark revoked
  await prisma.$transaction([
    prisma.page.update({
      where: { id: pageId },
      data: { ownerId: user.id },
    }),
    prisma.initiativeTransfer.update({
      where: { id: transfer.id },
      data: { status: "revoked", revokedAt: new Date() },
    }),
  ]);

  // Notify both parties (fire-and-forget)
  if (transfer.toUserId) {
    createNotification({
      userId: transfer.toUserId,
      type: "transfer_revoked",
      title: "Initiative ownership revoked",
      body: `Ownership of "${page?.title}" has been revoked by the original owner.`,
      link: "/app/initiatives",
    }).catch(console.error);
  }
  createNotification({
    userId: user.id,
    type: "transfer_revoked",
    title: "Initiative reclaimed",
    body: `You have reclaimed ownership of "${page?.title}".`,
    link: `/earn/initiative/${pageId}`,
  }).catch(console.error);

  return NextResponse.json({ ok: true });
}
