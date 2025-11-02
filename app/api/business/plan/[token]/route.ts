// app/api/business/plan/[token]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const plan = await prisma.businessPlan.findUnique({
      where: { retrievalToken: token },
    });

    if (!plan) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // optionally: remove sensitive fields
    const safePlan = {
      id: plan.id,
      title: plan.title,
      ownerEmail: plan.ownerEmail,
      ownerPhone: plan.ownerPhone,
      ownerVerified: plan.ownerVerified,
      dataJson: plan.dataJson,
      pdfPath: plan.pdfPath,
      status: plan.status,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };

    return NextResponse.json(safePlan, { status: 200 });
  } catch (err) {
    console.error("GET /api/business/plan/[token] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
