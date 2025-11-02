// app/api/business/plan/[token]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // ✅ correct import for your structure

export async function GET(
  req: Request,
  context: { params: Promise<Record<string, string>> | Record<string, string> }
) {
  try {
    const params = await context.params;
    const token = params?.token;
    console.log("[GET /api/business/plan/[token]] token:", token);

    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
    }

    const plan = await prisma.businessPlan.findFirst({
      where: { retrievalToken: token },
      select: {
        id: true,
        title: true,
        ownerEmail: true,
        ownerPhone: true,
        ownerUserId: true,
        ownerVerified: true,
        retrievalToken: true,
        dataJson: true,
        pdfPath: true,
        status: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
      },
    });

    if (!plan) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, plan });
  } catch (err: any) {
    console.error("GET /api/business/plan/[token] error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error", message: err?.message },
      { status: 500 }
    );
  }
}
