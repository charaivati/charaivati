// app/api/user/language/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifySessionToken, getTokenFromRequest } from "@/lib/session"; // adjust path

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const payload = await verifySessionToken(token);
    if (!payload || !payload.userId) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    if (payload.role === "guest") return NextResponse.json({ ok: false, error: "guest_readonly" }, { status: 403 });

    const body = await req.json();
    const locale = (body.locale || "").trim();
    if (!locale) return NextResponse.json({ ok: false, error: "Missing locale" }, { status: 400 });

    // Make sure user's table has a preferredLanguage column (string)
    await prisma.user.update({
      where: { id: payload.userId },
      data: { preferredLanguage: locale },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("/api/user/language error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
