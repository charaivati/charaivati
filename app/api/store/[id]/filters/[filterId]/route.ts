import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

async function ownerCheck(storeId: string, userId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { ownerId: true } });
  return store?.ownerId === userId;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; filterId: string }> }) {
  try {
    const { id, filterId } = await params;
    const user = await getServerUser(req);
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (!(await ownerCheck(id, user.id))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

    const { name, bannerId } = await req.json().catch(() => ({}));
    const filter = await prisma.storeFilter.update({
      where: { id: filterId },
      data: {
        ...(name !== undefined && { name }),
        ...(bannerId !== undefined && { bannerId: bannerId || null }),
      },
      include: { banner: true, sections: { select: { sectionId: true } } },
    });
    return NextResponse.json({ ok: true, filter: { ...filter, sectionIds: filter.sections.map((s) => s.sectionId) } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; filterId: string }> }) {
  try {
    const { id, filterId } = await params;
    const user = await getServerUser(req);
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (!(await ownerCheck(id, user.id))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

    await prisma.storeFilter.delete({ where: { id: filterId } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
