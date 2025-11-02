// app/(business)/business/api/plan/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

type Body = {
  title?: string;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  data?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function POST(req: Request) {
  try {
    const body: Body = await req.json();

    if (!body.data) {
      return NextResponse.json({ error: "Missing data payload" }, { status: 400 });
    }

    const title = body.title ?? (body.data?.vision?.title ?? "Untitled plan");

    // create a short retrieval token (8 chars, url-safe)
    const token = crypto.randomBytes(6).toString("base64url"); // ~8 chars

    const plan = await prisma.businessPlan.create({
      data: {
        title,
        ownerEmail: body.ownerEmail ?? null,
        ownerPhone: body.ownerPhone ?? null,
        retrievalToken: token,
        dataJson: body.data,
        ipAddress: body.ipAddress ?? null,
        userAgent: body.userAgent ?? null,
        // optional: expiresAt: add TTL if desired
      },
    });

    return NextResponse.json({
      success: true,
      planId: plan.id,
      retrievalToken: plan.retrievalToken,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/business/plan/${plan.retrievalToken}`,
    });
  } catch (err) {
    console.error("create plan error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
