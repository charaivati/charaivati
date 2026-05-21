import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

const VALID_SPECIALTIES = ["nutrition", "fitness", "sleep", "mental", "holistic"];
const VALID_MODES = ["manual", "rules", "agent"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;

  const page = await db.page.findUnique({ where: { id: pageId }, select: { ownerId: true } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (page.ownerId !== payload.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { specialty, credentials, consultationMode, searchTags, about } = body;

  if (specialty !== undefined && !VALID_SPECIALTIES.includes(specialty)) {
    return NextResponse.json({ error: "Invalid specialty" }, { status: 400 });
  }
  if (consultationMode !== undefined && !VALID_MODES.includes(consultationMode)) {
    return NextResponse.json({ error: "Invalid consultationMode" }, { status: 400 });
  }

  const updated = await db.healthBusiness.update({
    where: { pageId },
    data: {
      ...(specialty !== undefined && { specialty }),
      ...(credentials !== undefined && { credentials: credentials?.trim() || null }),
      ...(consultationMode !== undefined && { consultationMode }),
      ...(searchTags !== undefined && {
        searchTags: Array.isArray(searchTags) ? searchTags : [],
      }),
      ...(about !== undefined && { about: about?.trim() || null }),
    },
  });
  return NextResponse.json(updated);
}
