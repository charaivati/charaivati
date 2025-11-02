// app/api/business/plan/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

type ReqBody = {
  title?: string;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  ownerUserId?: string | null;
  data: any;
};

export async function POST(req: Request) {
  try {
    const body: ReqBody = await req.json();

    if (!body || !body.data) {
      return NextResponse.json({ error: "Missing plan data" }, { status: 400 });
    }

    // short url-safe token
    const token = crypto.randomBytes(6).toString("base64url"); // 8+ chars

    const plan = await prisma.businessPlan.create({
      data: {
        title: body.title ?? "Untitled plan",
        ownerEmail: body.ownerEmail ?? null,
        ownerPhone: body.ownerPhone ?? null,
        ownerUserId: body.ownerUserId ?? null,
        retrievalToken: token,
        dataJson: body.data,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "https://charaivati.com";
    const shareUrl = `${appUrl.replace(/\/$/, "")}/business/plan/${plan.retrievalToken}`;

    return NextResponse.json({ success: true, planId: plan.id, retrievalToken: plan.retrievalToken, shareUrl });
  } catch (err) {
    console.error("POST /api/business/plan error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
