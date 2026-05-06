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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; sectionId: string; tileId: string }> }) {
  try {
    const { id, sectionId, tileId } = await params;
    const user = await getServerUser(req);
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (!(await ownerCheck(id, sectionId, user.id))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

    const { label, imageUrl, imageKey } = await req.json().catch(() => ({}));
    const tile = await prisma.sectionTile.update({
      where: { id: tileId },
      data: {
        ...(label !== undefined && { label }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
        ...(imageKey !== undefined && { imageKey: imageKey || null }),
      },
    });
    return NextResponse.json({ ok: true, tile });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; sectionId: string; tileId: string }> }) {
  try {
    const { id, sectionId, tileId } = await params;
    const user = await getServerUser(_req);
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (!(await ownerCheck(id, sectionId, user.id))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

    await prisma.sectionTile.delete({ where: { id: tileId } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
