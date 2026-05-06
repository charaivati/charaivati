import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

async function ownerCheck(storeId: string, userId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { ownerId: true } });
  return store?.ownerId === userId;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; filterId: string }> }) {
  try {
    const { id, filterId } = await params;
    const user = await getServerUser(req);
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (!(await ownerCheck(id, user.id))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

    const { sectionIds } = await req.json().catch(() => ({ sectionIds: [] }));
    if (!Array.isArray(sectionIds)) return NextResponse.json({ error: "sectionIds_required" }, { status: 400 });

    await prisma.$transaction([
      prisma.storeSectionFilter.deleteMany({ where: { filterId } }),
      ...(sectionIds.length > 0
        ? [prisma.storeSectionFilter.createMany({
            data: sectionIds.map((sectionId: string) => ({ sectionId, filterId })),
            skipDuplicates: true,
          })]
        : []),
    ]);

    return NextResponse.json({ ok: true, sectionIds });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
