// app/api/business/plan/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // expected form payload:
    // { title, ownerEmail?, ownerPhone?, data: {...} }
    const { title, ownerEmail, ownerPhone, data } = body;
    if (!data) return NextResponse.json({ error: "missing data" }, { status: 400 });

    const retrievalToken = crypto.randomUUID();

    const plan = await prisma.businessPlan.create({
      data: {
        title: title ?? (data.shortDescription ? `${String(data.shortDescription).slice(0, 60)}` : "Untitled plan"),
        ownerEmail: ownerEmail ?? null,
        ownerPhone: ownerPhone ?? null,
        retrievalToken,
        dataJson: data,
      },
    });

    const base =
      (process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "")) ||
      (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")) ||
      "";

    const shareUrl = base ? `${base}/business/plan/${retrievalToken}` : `/business/plan/${retrievalToken}`;

    return NextResponse.json({
      ok: true,
      planId: plan.id,
      retrievalToken,
      shareUrl,
    });
  } catch (err: any) {
    console.error("POST /api/business/plan error:", err);
    return NextResponse.json({ error: err?.message ?? "internal" }, { status: 500 });
  }
}
