import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bookingId } = await params;
  const body = await req.json().catch(() => ({}));
  const { status, meetingLink } = body;

  const booking = await db.healthBooking.findUnique({
    where: { id: bookingId },
    include: { page: { select: { ownerId: true } } },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.page.ownerId !== payload.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const VALID_STATUSES = ["pending", "confirmed", "declined"];
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await db.healthBooking.update({
    where: { id: bookingId },
    data: {
      ...(status !== undefined && { status }),
      ...(meetingLink !== undefined && { meetingLink: meetingLink?.trim() || null }),
    },
    include: {
      service: { select: { id: true, title: true } },
      visitor: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
  return NextResponse.json(updated);
}
