// app/api/user/privacy/route.ts
//
// PRIV-ACT-1: minimal endpoint for the search-discoverability toggle.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export async function PATCH(req: Request) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.discoverable !== "boolean") {
    return NextResponse.json({ error: "discoverable must be a boolean" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: payload.userId },
    data: { discoverable: body.discoverable },
    select: { discoverable: true },
  });

  return NextResponse.json({ ok: true, discoverable: user.discoverable });
}
