// app/api/health-business/advice/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

const VALID_ADVICE_TYPES = new Set(["meal", "exercise", "sleep", "general"]);

export async function POST(req: Request) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { healthBusinessId, userId, advice, adviceType } = body;

    if (!healthBusinessId || !userId || !advice?.trim() || !adviceType) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    if (!VALID_ADVICE_TYPES.has(adviceType)) {
      return NextResponse.json({ error: "invalid_advice_type" }, { status: 400 });
    }

    // Verify ownership
    const hb = await prisma.healthBusiness.findUnique({
      where: { id: healthBusinessId },
      select: { page: { select: { ownerId: true } } },
    });
    if (!hb) {
      return NextResponse.json({ error: "health_business_not_found" }, { status: 404 });
    }
    if (hb.page.ownerId !== user.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    // Fetch consentFields for this subscriber
    const subscription = await prisma.expertSubscription.findFirst({
      where: { healthBusinessId, userId, status: "active" },
      select: { consentFields: true },
    });
    if (!subscription) {
      return NextResponse.json({ error: "subscriber_not_found" }, { status: 404 });
    }

    // Fetch subscriber's current health profile
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { health: true },
    });
    const fullHealth = (profile?.health ?? {}) as Record<string, unknown>;

    // Filter health to consented fields only
    const consentFields = Array.isArray(subscription.consentFields)
      ? (subscription.consentFields as string[])
      : null;

    const userStateSnapshot: Record<string, unknown> = consentFields
      ? Object.fromEntries(
          consentFields
            .filter((k) => k in fullHealth)
            .map((k) => [k, fullHealth[k]])
        )
      : {};

    const log = await prisma.expertAdviceLog.create({
      data: {
        healthBusinessId,
        userId,
        userStateSnapshot,
        advice: advice.trim(),
        adviceType,
        deliveredBy: "manual",
      },
    });

    return NextResponse.json({ ok: true, log }, { status: 201 });
  } catch (err: any) {
    console.error("POST advice error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
