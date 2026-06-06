// app/api/business/share/route.ts
// POST { ideaId, type } — mint (or return existing) shareToken for a document.
// Auth: session-OR-biz-guest ownership. Token is a cryptographically random UUID.
// A document with no shareToken is private; this is the only way to create one.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

const GUEST_COOKIE = "biz-guest";

async function resolveOwnership(req: NextRequest, ideaId: string) {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifySessionToken(token) : null;
  const sessionUserId = payload?.userId ?? null;
  const guestSessionId = req.cookies.get(GUEST_COOKIE)?.value ?? null;

  const idea = await (db as any).businessIdea.findUnique({
    where: { id: ideaId },
    select: { id: true, userId: true, guestSessionId: true },
  });
  if (!idea) return { allowed: false };

  const owned = idea.userId
    ? idea.userId === sessionUserId
    : !!guestSessionId && idea.guestSessionId === guestSessionId;

  return { allowed: owned };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ideaId, type } = body;

    if (!ideaId || !type) {
      return NextResponse.json({ error: "ideaId and type are required" }, { status: 400 });
    }

    const { allowed } = await resolveOwnership(req, ideaId);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const doc = await (db as any).businessDocument.findUnique({
      where: { ideaId_type: { ideaId, type } },
      select: { id: true, shareToken: true },
    });

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found. Save the document before sharing." },
        { status: 404 }
      );
    }

    // Idempotent: return existing token if already minted
    if (doc.shareToken) {
      return NextResponse.json({ shareToken: doc.shareToken });
    }

    const shareToken = randomUUID();

    await (db as any).businessDocument.update({
      where: { id: doc.id },
      data: { shareToken },
    });

    return NextResponse.json({ shareToken });
  } catch (err) {
    console.error("POST /api/business/share", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
