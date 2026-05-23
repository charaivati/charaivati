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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;
  const page = await verifyOwner(pageId, user.id);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [members, partners, userPages] = await Promise.all([
    // All team-scope collaborations for this initiative
    prisma.collaboration.findMany({
      where: { initiativeId: pageId, scope: "team" },
      include: { requester: { select: PAGE_SELECT }, receiver: { select: PAGE_SELECT } },
      orderBy: { createdAt: "asc" },
    }),
    // Partner-scope accepted collaborations eligible for promotion
    prisma.collaboration.findMany({
      where: {
        scope: "partner",
        status: "accepted",
        OR: [{ requesterId: pageId }, { receiverId: pageId }],
      },
      select: {
        id: true,
        requesterId: true,
        role: true,
        requester: { select: { id: true, title: true, avatarUrl: true } },
        receiver:  { select: { id: true, title: true, avatarUrl: true } },
      },
    }),
    // Current user's pages — to determine their team role
    prisma.page.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    }),
  ]);

  const userPageIds = new Set(userPages.map((p) => p.id));
  const userTeamCollab = members.find(
    (m) => userPageIds.has(m.requesterId) || userPageIds.has(m.receiverId)
  );
  const userTeamRole = userTeamCollab?.teamRole ?? null;

  return NextResponse.json({ members, partners, userTeamRole });
}
