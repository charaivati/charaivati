// app/api/business/idea/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { randomUUID } from "crypto";

const GUEST_COOKIE = "biz-guest";

function getGuestSessionId(req: NextRequest): string | null {
  return req.cookies.get(GUEST_COOKIE)?.value ?? null;
}

function setGuestCookie(res: NextResponse, guestSessionId: string): NextResponse {
  res.cookies.set(GUEST_COOKIE, guestSessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, userEmail, userPhone } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: "Title and description are required" },
        { status: 400 }
      );
    }

    const token = getTokenFromRequest(request);
    const payload = token ? await verifySessionToken(token) : null;
    const sessionUserId = payload?.userId ?? null;

    // For guests, use existing cookie or generate a new guestSessionId
    let guestSessionId = sessionUserId ? null : getGuestSessionId(request);
    if (!sessionUserId && !guestSessionId) {
      guestSessionId = randomUUID();
    }

    const shareToken = randomUUID().replace(/-/g, "").substring(0, 13);

    const idea = await (db as any).businessIdea.create({
      data: {
        title,
        description,
        userEmail,
        userPhone,
        userId: sessionUserId,
        guestSessionId: sessionUserId ? null : guestSessionId,
        shareToken,
        responses: {},
      },
    });

    const res = NextResponse.json(idea, { status: 201 });
    if (guestSessionId && !sessionUserId) {
      setGuestCookie(res, guestSessionId);
    }
    return res;
  } catch (error) {
    console.error("POST /api/business/idea", error);
    return NextResponse.json(
      { error: "Failed to create idea" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ideaId = searchParams.get("ideaId");
    const shareToken = searchParams.get("shareToken");

    if (!ideaId && !shareToken) {
      return NextResponse.json(
        { error: "ideaId or shareToken required" },
        { status: 400 }
      );
    }

    const idea = await (db as any).businessIdea.findFirst({
      where: ideaId ? { id: ideaId } : { shareToken },
      include: { ideaResponses: true },
    });

    if (!idea) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }

    return NextResponse.json(idea);
  } catch (error) {
    console.error("GET /api/business/idea", error);
    return NextResponse.json(
      { error: "Failed to fetch idea" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { ideaId, responses, status } = body;

    if (!ideaId) {
      return NextResponse.json(
        { error: "ideaId is required" },
        { status: 400 }
      );
    }

    const token = getTokenFromRequest(request);
    const payload = token ? await verifySessionToken(token) : null;
    const sessionUserId = payload?.userId ?? null;
    const guestSessionId = getGuestSessionId(request);

    const existing = await (db as any).businessIdea.findUnique({
      where: { id: ideaId },
      select: { userId: true, guestSessionId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }

    // Auth: logged-in user must own it, or guest cookie must match
    if (existing.userId) {
      if (existing.userId !== sessionUserId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      if (!guestSessionId || existing.guestSessionId !== guestSessionId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const updatedIdea = await (db as any).businessIdea.update({
      where: { id: ideaId },
      data: {
        responses: responses || undefined,
        status: status || undefined,
        updatedAt: new Date(),
      },
      include: { ideaResponses: true },
    });

    return NextResponse.json(updatedIdea);
  } catch (error) {
    console.error("PUT /api/business/idea", error);
    return NextResponse.json(
      { error: "Failed to update idea" },
      { status: 500 }
    );
  }
}
