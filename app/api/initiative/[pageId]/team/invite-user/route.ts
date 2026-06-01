import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

const VALID_TEAM_ROLES = ["founder", "co_founder", "ceo", "partner", "employee", "custom"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { ownerId: true },
  });
  if (!page || page.ownerId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as { userId?: string; teamRole?: string; customRole?: string };
  const { userId, teamRole, customRole } = body;

  if (!userId || !teamRole)
    return NextResponse.json({ error: "userId and teamRole are required" }, { status: 400 });

  if (!VALID_TEAM_ROLES.includes(teamRole))
    return NextResponse.json({ error: "Invalid teamRole" }, { status: 400 });

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Only friends of the page owner may be invited this way
  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userAId: user.id, userBId: userId },
        { userAId: userId, userBId: user.id },
      ],
    },
    select: { id: true },
  });
  if (!friendship)
    return NextResponse.json(
      { error: "You can only invite your Charaivati friends as team members" },
      { status: 403 }
    );

  // Idempotency: reject if already a team member via the user path
  const existing = await prisma.collaboration.findFirst({
    where: { requesterId: pageId, receiverUserId: userId, role: "employee" },
    select: { id: true },
  });
  if (existing)
    return NextResponse.json({ error: "This person is already a team member" }, { status: 409 });

  const collab = await prisma.collaboration.create({
    data: {
      requesterId:    pageId,
      receiverUserId: userId,
      role:           "employee",
      scope:          "team",
      teamRole,
      customRole:     teamRole === "custom" ? (customRole?.trim() || null) : null,
      status:         "accepted",
      initiativeId:   pageId,
    },
    include: {
      receiverUser: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return NextResponse.json(collab, { status: 201 });
}
