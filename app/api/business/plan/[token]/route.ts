// app/api/business/plan/[token]/route.ts
import { NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma"; // keep the relative path you use

export async function GET(req: Request, context: { params: Promise<Record<string,string>> | Record<string,string> }) {
  try {
    // await params per Next's requirement
    const params = await context.params;
    const token = Array.isArray(params?.token) ? params.token[0] : params?.token;
    console.log("🔎 GET /api/business/plan/[token] token:", token);

    if (!token) {
      console.warn("GET missing token");
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

    console.log("🔎 DB result for token:", token, plan ? "FOUND" : "NOT FOUND");

    if (!plan) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(plan);
  } catch (err: any) {
    console.error("❌ GET /api/business/plan/[token] error:", err);
    return NextResponse.json({ error: "server_error", message: String(err?.message ?? err) }, { status: 500 });
  }
}
