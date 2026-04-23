// app/api/health/my-experts/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    const subs = await prisma.expertSubscription.findMany({
      where: { userId: user.id, status: "active" },
      include: {
        healthBusiness: {
          select: {
            id: true,
            specialty: true,
            tiers: true,
            page: { select: { id: true, title: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { subscribedAt: "asc" },
    });

    const hbIds = subs.map((s) => s.healthBusinessId);

    const [adviceLogs, stores] = await Promise.all([
      prisma.expertAdviceLog.findMany({
        where: { healthBusinessId: { in: hbIds }, userId: user.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, healthBusinessId: true, advice: true, adviceType: true, createdAt: true },
      }),
      prisma.store.findMany({
        where: { pageId: { in: subs.map((s) => s.healthBusiness.page.id) } },
        select: { id: true, pageId: true },
      }),
    ]);

    const latestAdvice = new Map<string, (typeof adviceLogs)[0]>();
    for (const log of adviceLogs) {
      if (!latestAdvice.has(log.healthBusinessId)) latestAdvice.set(log.healthBusinessId, log);
    }

    const storeMap = new Map(stores.map((s) => [s.pageId!, s.id]));

    const experts = subs.map((sub) => {
      const hb = sub.healthBusiness;
      const advice = latestAdvice.get(hb.id);
      return {
        subscriptionId: sub.id,
        healthBusinessId: hb.id,
        pageId: hb.page.id,
        title: hb.page.title,
        avatarUrl: hb.page.avatarUrl ?? null,
        specialty: hb.specialty,
        tier: sub.tier,
        storeId: storeMap.get(hb.page.id) ?? null,
        latestAdvice: advice
          ? {
              id: advice.id,
              advice: advice.advice,
              adviceType: advice.adviceType,
              createdAt: advice.createdAt.toISOString(),
            }
          : null,
      };
    });

    return NextResponse.json({ ok: true, experts });
  } catch (err: any) {
    console.error("GET my-experts error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
