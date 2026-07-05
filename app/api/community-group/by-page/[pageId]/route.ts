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
    // Accept either a pageId cuid or a slug
    const isCuid = /^c[a-z0-9]{24}$/i.test(pageId);
    let groupId: string | null = null;
    if (isCuid) {
      const row = await db.communityGroup.findUnique({ where: { pageId }, select: { id: true } });
      groupId = row?.id ?? null;
    } else {
      const rows = await db.$queryRaw<{ id: string }[]>`SELECT id FROM "CommunityGroup" WHERE slug = ${pageId} LIMIT 1`;
      groupId = rows[0]?.id ?? null;
    }
    if (!groupId) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const group = await db.communityGroup.findUnique({
      where: { id: groupId },
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
        const page = await db.page.findUnique({ where: { id: group.pageId }, select: { ownerId: true } });
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

    const extra = await db.$queryRaw<{ emergencyContacts: unknown; bannerUrl: string | null; slug: string | null }[]>`SELECT "emergencyContacts", "bannerUrl", slug FROM "CommunityGroup" WHERE id = ${group.id}`;
    // foodPlan (SURVIVAL-1) queried separately + resilient — column may not
    // exist until the 20260705000000_add_community_food_plan migration runs.
    let foodPlan: unknown = null;
    try {
      const fp = await db.$queryRaw<{ foodPlan: unknown }[]>`SELECT "foodPlan" FROM "CommunityGroup" WHERE id = ${group.id}`;
      foodPlan = fp[0]?.foodPlan ?? null;
    } catch {}
    return NextResponse.json({ ok: true, group: { ...group, bannerUrl: extra[0]?.bannerUrl ?? null, emergencyContacts: extra[0]?.emergencyContacts ?? [], slug: extra[0]?.slug ?? null, foodPlan }, viewerStatus, pendingMemberships });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
