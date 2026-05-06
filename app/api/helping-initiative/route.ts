import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getServerUser(req);
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { pageId } = body;
    if (!pageId) return NextResponse.json({ error: "page_id_required" }, { status: 400 });

    const page = await prisma.page.findUnique({ where: { id: pageId }, select: { ownerId: true } });
    if (!page) return NextResponse.json({ error: "page_not_found" }, { status: 404 });
    if (page.ownerId !== user.id) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

    const initiative = await prisma.helpingInitiative.create({ data: { pageId } });
    return NextResponse.json({ ok: true, initiative }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/helping-initiative error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
