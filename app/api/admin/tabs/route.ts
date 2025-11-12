import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

async function verifyAdmin(req: NextRequest) {
  const adminEmail = process.env.EMAIL_USER;
  if (!adminEmail) return false;
  const user = await getCurrentUser(req);
  return user?.email === adminEmail;
}

// ✅ Fetch all English words (Tabs)
export async function GET() {
  try {
    const tabs = await prisma.tab.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, title: true, description: true },
    });
    return NextResponse.json({ ok: true, data: tabs });
  } catch (error: any) {
    console.error("GET /api/admin/tabs error:", error);
    return NextResponse.json({ ok: false, error: "Failed to fetch tabs" }, { status: 500 });
  }
}

// ✅ Add a new English word
export async function POST(req: NextRequest) {
  try {
    if (!(await verifyAdmin(req)))
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });

    const { title, description } = await req.json();

    if (!title?.trim())
      return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });

    // generate slug safely
    let slug = title.toLowerCase().replace(/\s+/g, "-").slice(0, 60);
    const existing = await prisma.tab.findUnique({ where: { slug } });
    if (existing) slug += "-" + Math.floor(Math.random() * 1000);

    // ✅ FIX: don't set levelId, to avoid foreign key issue
    const created = await prisma.tab.create({
      data: {
        title,
        slug,
        description,
        is_default: false,
        is_custom: false,
        usageCount: 0,
      },
    });

    return NextResponse.json({ ok: true, data: created });
  } catch (error: any) {
    console.error("POST /api/admin/tabs error:", error);
    return NextResponse.json({ ok: false, error: "Failed to create tab" }, { status: 500 });
  }
}

// ✅ Update existing English words
export async function PUT(req: NextRequest) {
  try {
    if (!(await verifyAdmin(req)))
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });

    const body = await req.json();
    const rows = Array.isArray(body.rows) ? body.rows : [];

    if (!rows.length)
      return NextResponse.json({ ok: false, error: "No rows provided" }, { status: 400 });

    for (const r of rows) {
      if (!r.id) continue;
      await prisma.tab.update({
        where: { id: r.id },
        data: {
          title: r.title ?? "",
          description: r.description ?? null,
          updatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("PUT /api/admin/tabs error:", error);
    return NextResponse.json({ ok: false, error: "Failed to update tabs" }, { status: 500 });
  }
}
