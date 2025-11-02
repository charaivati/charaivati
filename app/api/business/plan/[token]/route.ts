// app/api/business/plan/[token]/route.ts
import { NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma"; // <-- relative path to lib/prisma

export async function GET(req: Request, context: { params: Promise<Record<string,string>> | Record<string,string> }) {
  try {
    // IMPORTANT: await params (Next warning you saw)
    const params = await context.params;
    const token = params?.token;
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
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
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(plan);
  } catch (err: any) {
    console.error("GET /api/business/plan/[token] error:", err);
    return NextResponse.json({ error: "server_error", message: String(err?.message ?? err) }, { status: 500 });
  }
}
