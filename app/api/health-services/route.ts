import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pageId = searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });

  const services = await db.healthService.findMany({
    where: { pageId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(services);
}

export async function POST(req: Request) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { pageId, title, description, duration, price } = body;

  if (!pageId || !title?.trim()) {
    return NextResponse.json({ error: "pageId and title are required" }, { status: 400 });
  }

  const page = await db.page.findUnique({ where: { id: pageId }, select: { ownerId: true } });
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
  if (page.ownerId !== payload.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = await db.healthService.create({
    data: {
      pageId,
      title: title.trim(),
      description: description?.trim() || null,
      duration: duration?.trim() || null,
      price: price?.trim() || null,
    },
  });
  return NextResponse.json(service, { status: 201 });
}
