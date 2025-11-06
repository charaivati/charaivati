// app/api/business/plan/[token]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: Request,
  context: { params: Promise<Record<string,string>> | Record<string,string> }
) {
  try {
    const params = await context.params;
    const token = params?.token;
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const plan = await prisma.businessPlan.findFirst({
      where: { retrievalToken: token },
      select: {
        id: true, title: true, ownerEmail: true, ownerPhone: true,
        ownerUserId: true, ownerVerified: true, retrievalToken: true,
        dataJson: true, pdfPath: true, status: true, ipAddress: true,
        userAgent: true, createdAt: true, updatedAt: true, expiresAt: true,
      },
    });

    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true, plan });
  } catch (err: any) {
    console.error("GET /api/business/plan/[token] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
