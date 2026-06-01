import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

async function verifyOwner(pageId: string, userId: string) {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { ownerId: true },
  });
  return page?.ownerId === userId ? page : null;
}

const PAGE_SELECT = {
  id: true,
  title: true,
  avatarUrl: true,
  ownerId: true,
  owner: { select: { id: true, name: true, email: true } },
} as const;

const USER_SELECT = { id: true, name: true, avatarUrl: true } as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;
  const page = await verifyOwner(pageId, user.id);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [members, partners, userPages, friendships] = await Promise.all([
    // All team-scope collaborations for this initiative (page-type and user-type)
    prisma.collaboration.findMany({
      where: { initiativeId: pageId, scope: "team" },
      include: {
        requester:    { select: PAGE_SELECT },
        receiverPage: { select: PAGE_SELECT },
        receiverUser: { select: USER_SELECT },
      },
      orderBy: { createdAt: "asc" },
    }),
    // Partner-scope accepted page-to-page collaborations eligible for promotion
    prisma.collaboration.findMany({
      where: {
        scope: "partner",
        status: "accepted",
        OR: [{ requesterId: pageId }, { receiverPageId: pageId }],
      },
      select: {
        id: true,
        requesterId: true,
        role: true,
        requester:    { select: { id: true, title: true, avatarUrl: true } },
        receiverPage: { select: { id: true, title: true, avatarUrl: true } },
      },
    }),
    // Current user's pages — to determine their team role
    prisma.page.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    }),
    // Owner's accepted friendships — for the friend-invite path
    prisma.friendship.findMany({
      where: {
        OR: [{ userAId: user.id }, { userBId: user.id }],
      },
      select: {
        userA: { select: USER_SELECT },
        userB: { select: USER_SELECT },
      },
    }),
  ]);

  // Derive friends list (the "other" user in each friendship)
  const allFriends = friendships.map((f) =>
    f.userA.id === user.id ? f.userB : f.userA
  );

  // Exclude friends already added as user-type team members
  const teamUserIds = new Set(
    members
      .filter((m) => !!m.receiverUserId)
      .map((m) => m.receiverUserId as string)
  );
  const friends = allFriends.filter((f) => !teamUserIds.has(f.id));

  // Determine the current user's team role
  const userPageIds = new Set(userPages.map((p) => p.id));
  const userTeamCollab = members.find(
    (m) =>
      userPageIds.has(m.requesterId) ||
      (m.receiverPageId && userPageIds.has(m.receiverPageId)) ||
      m.receiverUserId === user.id
  );
  const userTeamRole = userTeamCollab?.teamRole ?? null;

  return NextResponse.json({ members, partners, friends, userTeamRole });
}
