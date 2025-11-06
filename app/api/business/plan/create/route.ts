// app/api/business/plan/create/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, dataJson, ownerEmail, ownerPhone, ownerUserId, ip, userAgent } = body;

    if (!token || !dataJson) return NextResponse.json({ error: "missing token or data" }, { status: 400 });

    // generate retrieval token if not present (uuid)
    const retrievalToken = crypto.randomUUID();

    const payload: any = {
      title: dataJson.title ?? "Untitled Plan",
      retrievalToken,
      dataJson,
      ownerEmail: ownerEmail ?? null,
      ownerPhone: ownerPhone ?? null,
      ownerUserId: ownerUserId ?? null,
      ipAddress: ip ?? null,
      userAgent: userAgent ?? null,
    };

    // create a BusinessPlan
    const plan = await prisma.businessPlan.create({
      data: payload,
    });

    return NextResponse.json({ ok: true, id: plan.id, retrievalToken: plan.retrievalToken });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "internal" }, { status: 500 });
  }
}
