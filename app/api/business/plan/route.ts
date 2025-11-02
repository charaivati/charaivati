// app/api/business/plan/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    if (!body?.data) {
      console.warn("[POST /api/business/plan] Missing plan data:", body);
      return NextResponse.json({ ok: false, error: "Missing plan data" }, { status: 400 });
    }

    const token = crypto.randomBytes(6).toString("base64url");

    const plan = await prisma.businessPlan.create({
      data: {
        title: body.title ?? "Untitled plan",
        ownerEmail: body.ownerEmail ?? null,
        ownerPhone: body.ownerPhone ?? null,
        ownerUserId: body.ownerUserId ?? null,
        retrievalToken: token,
        dataJson: body.data ?? {},
        status: "draft",
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXTAUTH_URL ?? "https://charaivati.com";
    const shareUrl = `${baseUrl.replace(/\/$/, "")}/business/plan/${plan.retrievalToken}`;

    return NextResponse.json({
      ok: true,
      planId: plan.id,
      retrievalToken: plan.retrievalToken,
      shareUrl,
    });
  } catch (err: any) {
    console.error("❌ [POST /api/business/plan] Error:", err);
    return NextResponse.json(
      { ok: false, error: "server_error", message: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
