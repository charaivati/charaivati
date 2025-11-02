// app/api/business/plan/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "../../../../lib/prisma"; // <-- relative path to lib/prisma

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    // minimal validation
    const token = crypto.randomBytes(6).toString("base64url");

    const plan = await prisma.businessPlan.create({
      data: {
        title: body.title ?? "Untitled plan",
        ownerEmail: body.ownerEmail ?? null,
        ownerPhone: body.ownerPhone ?? null,
        retrievalToken: token,
        dataJson: body.data ?? {},
        status: "draft",
      },
    });

    return NextResponse.json({
      ok: true,
      planId: plan.id,
      retrievalToken: plan.retrievalToken,
      shareUrl: `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/business/plan/${plan.retrievalToken}`,
    });
  } catch (err: any) {
    console.error("POST /api/business/plan error:", err);
    return NextResponse.json(
      { ok: false, error: "server_error", message: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
