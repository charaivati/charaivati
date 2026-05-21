import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { serviceId } = await params;
  const body = await req.json().catch(() => ({}));
  const { title, description, duration, price } = body;

  const service = await db.healthService.findUnique({
    where: { id: serviceId },
    include: { page: { select: { ownerId: true } } },
  });
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (service.page.ownerId !== payload.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await db.healthService.update({
    where: { id: serviceId },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(duration !== undefined && { duration: duration?.trim() || null }),
      ...(price !== undefined && { price: price?.trim() || null }),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { serviceId } = await params;

  const service = await db.healthService.findUnique({
    where: { id: serviceId },
    include: { page: { select: { ownerId: true } } },
  });
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (service.page.ownerId !== payload.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.healthService.delete({ where: { id: serviceId } });
  return NextResponse.json({ ok: true });
}
