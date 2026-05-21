import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;

  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { ownerId: true, healthBusiness: { select: { id: true } } },
  });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (page.ownerId !== payload.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const hb = page.healthBusiness;
  if (!hb) return NextResponse.json({ error: "No health business for this page" }, { status: 404 });

  const subs = await db.expertSubscription.findMany({
    where: { healthBusinessId: hb.id, status: "active" },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { subscribedAt: "asc" },
  });

  // Batch-fetch profiles for health snapshots
  const userIds = subs.map((s) => s.userId);
  const profiles = await db.profile.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, health: true },
  });
  const profileMap = new Map(profiles.map((p) => [p.userId, p.health]));

  // Batch-fetch latest advice per subscriber
  const adviceLogs = await db.expertAdviceLog.findMany({
    where: { healthBusinessId: hb.id, userId: { in: userIds } },
    orderBy: { createdAt: "desc" },
    select: { userId: true, createdAt: true },
  });
  const lastAdviceMap = new Map<string, string>();
  for (const log of adviceLogs) {
    if (!lastAdviceMap.has(log.userId)) {
      lastAdviceMap.set(log.userId, log.createdAt.toISOString());
    }
  }

  const subscribers = subs.map((s) => {
    const rawHealth = profileMap.get(s.userId) ?? null;
    const consentFields = Array.isArray(s.consentFields) ? (s.consentFields as string[]) : null;
    const health: Record<string, unknown> | null = rawHealth && typeof rawHealth === "object"
      ? (rawHealth as Record<string, unknown>)
      : null;

    return {
      subscriptionId: s.id,
      userId: s.userId,
      tier: s.tier,
      subscribedAt: s.subscribedAt.toISOString(),
      consentGranted: s.consentGranted,
      consentFields,
      user: { name: s.user.name, avatarUrl: s.user.avatarUrl },
      health,
      lastAdviceAt: lastAdviceMap.get(s.userId) ?? null,
    };
  });

  return NextResponse.json({ ok: true, businessId: hb.id, subscribers });
}
