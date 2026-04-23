// app/api/health-business/create/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

const VALID_SPECIALTIES = new Set(["nutrition", "fitness", "sleep", "mental", "holistic"]);

export async function POST(req: Request) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { pageId, specialty, credentials, consultationMode, searchTags, tiers } = body;

    if (!pageId) {
      return NextResponse.json({ error: "page_id_required" }, { status: 400 });
    }
    if (!specialty || !VALID_SPECIALTIES.has(specialty)) {
      return NextResponse.json({ error: "invalid_specialty" }, { status: 400 });
    }

    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { ownerId: true },
    });

    if (!page) {
      return NextResponse.json({ error: "page_not_found" }, { status: 404 });
    }
    if (page.ownerId !== user.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const healthBusiness = await prisma.healthBusiness.create({
      data: {
        pageId,
        specialty,
        credentials: credentials || null,
        consultationMode: consultationMode || "manual",
        searchTags: Array.isArray(searchTags) ? searchTags : [],
        tiers: tiers ?? null,
      },
    });

    return NextResponse.json({ ok: true, healthBusiness }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/health-business/create error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
