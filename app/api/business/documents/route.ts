// app/api/business/documents/route.ts
// GET  ?ideaId=   → list all documents for the idea
// PUT  { ideaId, type, content, title?, status? }  → upsert document

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

const GUEST_COOKIE = "biz-guest";

async function resolveOwnership(
  req: NextRequest,
  ideaId: string
): Promise<{ allowed: boolean; idea?: any }> {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifySessionToken(token) : null;
  const sessionUserId = payload?.userId ?? null;
  const guestSessionId = req.cookies.get(GUEST_COOKIE)?.value ?? null;

  const idea = await (db as any).businessIdea.findUnique({
    where: { id: ideaId },
    select: { id: true, userId: true, guestSessionId: true },
  });

  if (!idea) return { allowed: false };

  if (idea.userId) {
    return { allowed: idea.userId === sessionUserId, idea };
  }
  return {
    allowed: !!guestSessionId && idea.guestSessionId === guestSessionId,
    idea,
  };
}

const VALID_TYPES = ["SWOT", "BMC", "FINANCIALS", "PROPOSAL", "COMPETITOR"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ideaId = searchParams.get("ideaId");

  if (!ideaId) {
    return NextResponse.json({ error: "ideaId required" }, { status: 400 });
  }

  const { allowed } = await resolveOwnership(req, ideaId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const docs = await (db as any).businessDocument.findMany({
    where: { ideaId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(docs);
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { ideaId, type, content, title, status } = body;

    if (!ideaId || !type || !content) {
      return NextResponse.json(
        { error: "ideaId, type, and content are required" },
        { status: 400 }
      );
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const { allowed } = await resolveOwnership(req, ideaId);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // pdfUrl is invalidated on every save so stale cached PDFs are never served
    const doc = await (db as any).businessDocument.upsert({
      where: { ideaId_type: { ideaId, type } },
      update: {
        content,
        title: title ?? undefined,
        status: status ?? undefined,
        pdfUrl: null,
        updatedAt: new Date(),
      },
      create: {
        ideaId,
        type,
        content,
        title: title ?? "",
        status: status ?? "DRAFT",
        pdfUrl: null,
      },
    });

    return NextResponse.json(doc);
  } catch (error) {
    console.error("PUT /api/business/documents", error);
    return NextResponse.json(
      { error: "Failed to save document" },
      { status: 500 }
    );
  }
}
