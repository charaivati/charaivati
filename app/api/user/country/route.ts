// app/api/user/country/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const country = String(body?.country ?? "").trim();
    if (!country) {
      return NextResponse.json({ ok: false, error: "missing_country" }, { status: 400 });
    }

    const token = getTokenFromRequest(req);
    const payload = await verifySessionToken(token);

    if (!payload?.userId) {
      console.debug("[POST /api/user/country] unauthenticated - not persisting");
      return NextResponse.json({ ok: true, persisted: false, userId: null, note: "no-auth" });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user) {
      console.warn("[POST /api/user/country] user not found for", payload.userId);
      return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    }

    console.info(`[POST /api/user/country] updating userId=${user.id} selectedCountry=${country}`);
    await prisma.user.update({
      where: { id: user.id },
      data: { selectedCountry: country } as any,
    });

    console.info(`[POST /api/user/country] persisted for userId=${user.id}`);
    return NextResponse.json({ ok: true, persisted: true, userId: user.id, country });
  } catch (err) {
    console.error("POST /api/user/country error:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const token = getTokenFromRequest(req);
    const payload = await verifySessionToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { selectedCountry: true },
    });
    return NextResponse.json({ ok: true, selectedCountry: user?.selectedCountry ?? null });
  } catch (err) {
    console.error("GET /api/user/country error:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
