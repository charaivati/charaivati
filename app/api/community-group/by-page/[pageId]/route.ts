import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  const token = getTokenFromRequest(req);
  const payload = token ? await verifySessionToken(token) : null;
  const userId = payload?.userId ?? null;

  try {
    const group = await db.communityGroup.findUnique({
      where: { pageId },
      include: {
        boardMembers: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: "asc" },
        },
        memberships: {
          where: { status: "approved" },
          include: {
            memberUser: { select: { id: true, name: true, avatarUrl: true } },
            memberGroup: { select: { id: true, name: true, logoUrl: true, pageId: true } },
          },
          orderBy: { resolvedAt: "asc" },
        },
        milestones: { orderBy: { createdAt: "asc" } },
        meetings: { orderBy: { date: "asc" } },
      },
    });

    if (!group) return NextResponse.json({ error: "not_found" }, { status: 404 });

    let viewerStatus: "guest" | "non_member" | "pending" | "member" | "admin" = "guest";

    if (userId) {
      const isBoardMember = group.boardMembers.some((b) => b.userId === userId);
      if (isBoardMember) {
        viewerStatus = "admin";
      } else {
        const membership = await db.communityMembership.findFirst({
          where: { groupId: group.id, memberUserId: userId },
        });
        if (!membership) viewerStatus = "non_member";
        else if (membership.status === "pending") viewerStatus = "pending";
        else if (membership.status === "approved") viewerStatus = "member";
        else viewerStatus = "non_member";
      }

      if (viewerStatus !== "admin") {
        const page = await db.page.findUnique({ where: { id: pageId }, select: { ownerId: true } });
        if (page?.ownerId === userId) viewerStatus = "admin";
      }
    }

    const pendingMemberships =
      viewerStatus === "admin"
        ? await db.communityMembership.findMany({
            where: { groupId: group.id, status: "pending" },
            include: {
              memberUser: { select: { id: true, name: true, avatarUrl: true } },
              memberGroup: { select: { id: true, name: true, logoUrl: true, pageId: true } },
            },
            orderBy: { requestedAt: "asc" },
          })
        : [];

    return NextResponse.json({ ok: true, group, viewerStatus, pendingMemberships });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
