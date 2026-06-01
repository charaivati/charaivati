import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

type Params = { params: Promise<{ pageId: string; collaborationId: string }> };

async function verifyPageOwner(pageId: string, userId: string) {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { ownerId: true },
  });
  return page?.ownerId === userId;
}

// PATCH — promote to team (scope="team") or demote back to partner (scope="partner")
export async function PATCH(req: NextRequest, { params }: Params) {
  const { pageId, collaborationId } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await verifyPageOwner(pageId, user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const collab = await prisma.collaboration.findUnique({
    where: { id: collaborationId },
    select: { requesterId: true, receiverPageId: true },
  });
  if (!collab || (collab.requesterId !== pageId && collab.receiverPageId !== pageId))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as {
    scope: string;
    teamRole?: string | null;
    customRole?: string | null;
    initiativeId?: string | null;
  };

  if (!["team", "partner"].includes(body.scope))
    return NextResponse.json({ error: "scope must be 'team' or 'partner'" }, { status: 400 });

  const updated = await prisma.collaboration.update({
    where: { id: collaborationId },
    data: {
      scope:        body.scope,
      teamRole:     body.teamRole     ?? null,
      customRole:   body.customRole   ?? null,
      initiativeId: body.initiativeId ?? null,
    },
    include: {
      requester:    { select: { id: true, title: true, avatarUrl: true } },
      receiverPage: { select: { id: true, title: true, avatarUrl: true } },
      receiverUser: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return NextResponse.json(updated);
}

// DELETE — remove a user-type team member (receiverUserId set)
export async function DELETE(req: NextRequest, { params }: Params) {
  const { pageId, collaborationId } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await verifyPageOwner(pageId, user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const collab = await prisma.collaboration.findUnique({
    where: { id: collaborationId },
    select: { requesterId: true, receiverUserId: true, scope: true },
  });
  if (!collab || collab.requesterId !== pageId || !collab.receiverUserId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.collaboration.delete({ where: { id: collaborationId } });
  return NextResponse.json({ ok: true });
}
