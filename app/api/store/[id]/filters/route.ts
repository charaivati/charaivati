import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

async function ownerCheck(storeId: string, userId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { ownerId: true } });
  return store?.ownerId === userId;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const filters = await prisma.storeFilter.findMany({
    where: { storeId: id },
    orderBy: { order: "asc" },
    include: {
      banner: true,
      sections: { select: { sectionId: true } },
    },
  });
  const shaped = filters.map((f) => ({ ...f, sectionIds: f.sections.map((s) => s.sectionId) }));
  return NextResponse.json({ ok: true, filters: shaped });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getServerUser(req);
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (!(await ownerCheck(id, user.id))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

    const { name } = await req.json().catch(() => ({}));
    if (!name?.trim()) return NextResponse.json({ error: "name_required" }, { status: 400 });

    const count = await prisma.storeFilter.count({ where: { storeId: id } });
    const filter = await prisma.storeFilter.create({
      data: { storeId: id, name: name.trim(), order: count },
      include: { banner: true, sections: { select: { sectionId: true } } },
    });
    return NextResponse.json({ ok: true, filter: { ...filter, sectionIds: [] } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
