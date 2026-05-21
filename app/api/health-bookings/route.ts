import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const pageId = searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });

  const page = await db.page.findUnique({ where: { id: pageId }, select: { ownerId: true } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = page.ownerId === payload.userId;

  if (isOwner) {
    const bookings = await db.healthBooking.findMany({
      where: { pageId },
      orderBy: { createdAt: "desc" },
      include: {
        service: { select: { id: true, title: true } },
        visitor: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    return NextResponse.json(bookings);
  }

  // Visitor — return only their own bookings for this page
  const bookings = await db.healthBooking.findMany({
    where: { pageId, visitorId: payload.userId },
    orderBy: { createdAt: "desc" },
    include: {
      service: { select: { id: true, title: true } },
    },
  });
  return NextResponse.json(bookings);
}

export async function POST(req: Request) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { pageId, serviceId, preferredTime, message } = body;

  if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });

  const page = await db.page.findUnique({ where: { id: pageId }, select: { ownerId: true } });
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
  if (page.ownerId === payload.userId) {
    return NextResponse.json({ error: "Owner cannot book their own page" }, { status: 403 });
  }

  const booking = await db.healthBooking.create({
    data: {
      pageId,
      visitorId: payload.userId,
      serviceId: serviceId || null,
      preferredTime: preferredTime ? new Date(preferredTime) : null,
      message: message?.trim() || null,
    },
    include: {
      service: { select: { id: true, title: true } },
    },
  });
  return NextResponse.json(booking, { status: 201 });
}
