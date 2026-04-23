// app/api/pages/[id]/subscribe/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const pageId = params.id;
    const body = await req.json().catch(() => ({}));
    const { tier, consentGranted, consentTimestamp, consentFields } = body;

    if (!tier) {
      return NextResponse.json({ error: "tier_required" }, { status: 400 });
    }

    // Look up the HealthBusiness linked to this page
    const healthBusiness = await prisma.healthBusiness.findUnique({
      where: { pageId },
      select: { id: true, page: { select: { ownerId: true } } },
    });
    if (!healthBusiness) {
      return NextResponse.json({ error: "health_business_not_found" }, { status: 404 });
    }

    // Owner cannot subscribe to their own page
    if (healthBusiness.page.ownerId === user.id) {
      return NextResponse.json({ error: "cannot_subscribe_own_page" }, { status: 400 });
    }

    const subscription = await prisma.expertSubscription.upsert({
      where: {
        userId_healthBusinessId: {
          userId: user.id,
          healthBusinessId: healthBusiness.id,
        },
      },
      create: {
        userId: user.id,
        healthBusinessId: healthBusiness.id,
        tier,
        status: "active",
        consentGranted: consentGranted ?? true,
        consentTimestamp: consentTimestamp ? new Date(consentTimestamp) : new Date(),
        consentFields: consentFields ?? [],
      },
      update: {
        tier,
        status: "active",
        consentGranted: consentGranted ?? true,
        consentTimestamp: consentTimestamp ? new Date(consentTimestamp) : new Date(),
        consentFields: consentFields ?? [],
      },
    });

    return NextResponse.json({ subscribed: true, subscription }, { status: 201 });
  } catch (err: any) {
    console.error("POST subscribe error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
