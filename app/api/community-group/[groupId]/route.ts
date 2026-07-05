import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

async function isAdmin(groupId: string, userId: string): Promise<boolean> {
  const group = await db.communityGroup.findUnique({
    where: { id: groupId },
    include: { page: { select: { ownerId: true } }, boardMembers: { select: { userId: true } } },
  });
  if (!group) return false;
  return group.page.ownerId === userId || group.boardMembers.some((b) => b.userId === userId);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isAdmin(groupId, payload.userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { name, logoUrl, bannerUrl, objective, emergencyContacts, foodPlan } = await req.json();
    const group = await db.communityGroup.update({
      where: { id: groupId },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(logoUrl !== undefined ? { logoUrl } : {}),
        ...(objective !== undefined ? { objective: objective.trim() || null } : {}),
      },
    });
    if (bannerUrl !== undefined) {
      await db.$executeRaw`UPDATE "CommunityGroup" SET "bannerUrl" = ${bannerUrl} WHERE id = ${groupId}`;
    }
    if (emergencyContacts !== undefined) {
      await db.$executeRaw`UPDATE "CommunityGroup" SET "emergencyContacts" = ${JSON.stringify(emergencyContacts)}::jsonb WHERE id = ${groupId}`;
    }
    if (foodPlan !== undefined) {
      // SURVIVAL-1 — same raw-SQL pattern as emergencyContacts
      await db.$executeRaw`UPDATE "CommunityGroup" SET "foodPlan" = ${JSON.stringify(foodPlan)}::jsonb WHERE id = ${groupId}`;
    }
    const extra = await db.$queryRaw<{ emergencyContacts: unknown; bannerUrl: string | null }[]>`SELECT "emergencyContacts", "bannerUrl" FROM "CommunityGroup" WHERE id = ${groupId}`;
    return NextResponse.json({ ok: true, group: { ...group, bannerUrl: extra[0]?.bannerUrl ?? null, emergencyContacts: extra[0]?.emergencyContacts ?? [] } });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
