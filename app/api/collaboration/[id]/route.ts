import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

const COLLAB_SELECT = {
  id: true,
  requesterId: true,
  receiverId: true,
  role: true,
  status: true,
  message: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  requester: { select: { ownerId: true } },
  receiver: { select: { ownerId: true } },
} as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status } = await req.json();
  const allowed = ["accepted", "rejected", "cancelled"];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "status must be accepted, rejected, or cancelled" }, { status: 400 });
  }

  const collab = await prisma.collaboration.findUnique({
    where: { id },
    select: COLLAB_SELECT,
  });
  if (!collab) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (status === "cancelled") {
    if (collab.requester.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    if (collab.receiver.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const updated = await prisma.collaboration.update({
    where: { id },
    data: { status },
    include: {
      requester: { select: { id: true, title: true, pageType: true, avatarUrl: true } },
      receiver:  { select: { id: true, title: true, pageType: true, avatarUrl: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const collab = await prisma.collaboration.findUnique({
    where: { id },
    select: COLLAB_SELECT,
  });
  if (!collab) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ownsRequester = collab.requester.ownerId === user.id;
  const ownsReceiver = collab.receiver.ownerId === user.id;
  if (!ownsRequester && !ownsReceiver) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.collaboration.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
