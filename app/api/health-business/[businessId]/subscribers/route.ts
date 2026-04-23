// app/api/health-business/[businessId]/subscribers/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

type Ctx = { params: { businessId: string } };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const { businessId } = params;

    const hb = await prisma.healthBusiness.findUnique({
      where: { id: businessId },
      select: { id: true, page: { select: { ownerId: true } } },
    });
    if (!hb) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (hb.page.ownerId !== user.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const subscriptions = await prisma.expertSubscription.findMany({
      where: { healthBusinessId: businessId, status: "active" },
      select: {
        id: true,
        userId: true,
        tier: true,
        subscribedAt: true,
        consentGranted: true,
        consentFields: true,
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            profile: { select: { health: true } },
          },
        },
      },
      orderBy: { subscribedAt: "desc" },
    });

    // Fetch all advice logs for this business, keep latest per userId
    const allAdvices = await prisma.expertAdviceLog.findMany({
      where: { healthBusinessId: businessId },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    const lastAdviceMap = new Map<string, Date>();
    for (const a of allAdvices) {
      if (!lastAdviceMap.has(a.userId)) lastAdviceMap.set(a.userId, a.createdAt);
    }

    const subscribers = subscriptions.map((s) => ({
      subscriptionId: s.id,
      userId: s.userId,
      tier: s.tier,
      subscribedAt: s.subscribedAt,
      consentGranted: s.consentGranted,
      consentFields: s.consentFields,
      user: { name: s.user.name, avatarUrl: s.user.avatarUrl },
      health: s.user.profile?.health ?? null,
      lastAdviceAt: lastAdviceMap.get(s.userId) ?? null,
    }));

    return NextResponse.json({ ok: true, subscribers });
  } catch (err: any) {
    console.error("GET subscribers error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
