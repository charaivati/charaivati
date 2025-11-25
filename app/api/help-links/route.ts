// app/api/help-links/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

function isAdmin(user: any) {
  if (!user || !user.email) return false;
  const env = (process.env.EMAIL_USER || "").toLowerCase();
  return env && user.email.toLowerCase() === env;
}

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const pageSlug = url.searchParams.get("pageSlug")?.trim() || undefined;
    const country = url.searchParams.get("country")?.trim() || undefined;
    const q = url.searchParams.get("q")?.trim() || undefined;

    const where: any = {};
    if (pageSlug) where.pageSlug = pageSlug;
    if (country) where.country = country;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { url: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
      ];
    }

    const links = await prisma.helpLink.findMany({
      where,
      orderBy: { pageSlug: "asc", createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, data: links });
  } catch (e: any) {
    console.error("GET /api/help-links", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!isAdmin(user)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { pageSlug, country, title, url, notes } = body || {};

    if (!pageSlug || !url || !title) {
      return NextResponse.json({ ok: false, error: "pageSlug, title and url are required" }, { status: 400 });
    }

    const created = await prisma.helpLink.create({
      data: {
        pageSlug,
        country: country || "All",
        title,
        url,
        notes: notes || null,
        createdBy: user.id,
      },
    });

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/help-links", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
