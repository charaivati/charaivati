import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

async function ownerCheck(storeId: string, sectionId: string, userId: string) {
  const section = await prisma.storeSection.findUnique({
    where: { id: sectionId },
    select: { storeId: true, store: { select: { ownerId: true } } },
  });
  return section?.storeId === storeId && section?.store.ownerId === userId;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; sectionId: string }> }) {
  const { sectionId } = await params;
  const tiles = await prisma.sectionTile.findMany({
    where: { sectionId },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ ok: true, tiles });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; sectionId: string }> }) {
  try {
    const { id, sectionId } = await params;
    const user = await getServerUser(req);
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (!(await ownerCheck(id, sectionId, user.id))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

    const { label, imageUrl, imageKey, order } = await req.json().catch(() => ({}));
    if (!label?.trim()) return NextResponse.json({ error: "label_required" }, { status: 400 });

    const count = await prisma.sectionTile.count({ where: { sectionId } });
    const tile = await prisma.sectionTile.create({
      data: {
        sectionId,
        label: label.trim(),
        imageUrl: imageUrl || null,
        imageKey: imageKey || null,
        order: typeof order === "number" ? order : count,
      },
    });
    return NextResponse.json({ ok: true, tile }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
