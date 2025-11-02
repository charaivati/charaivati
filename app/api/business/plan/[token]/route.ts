// app/api/business/plan/[token]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { token: string } }) {
  try {
    const token = params.token;
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    const plan = await prisma.businessPlan.findUnique({
      where: { retrievalToken: token },
      select: {
        id: true,
        title: true,
        ownerEmail: true,
        ownerPhone: true,
        ownerUserId: true,
        ownerVerified: true,
        dataJson: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
      },
    });

    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, plan });
  } catch (err) {
    console.error("GET /api/business/plan/[token] error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
