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
  const banners = await prisma.storeBanner.findMany({
    where: { storeId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ ok: true, banners });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getServerUser(req);
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (!(await ownerCheck(id, user.id))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

    const { isGlobal, imageUrl, imageKey, heading, subheading, body } = await req.json().catch(() => ({}));
    const banner = await prisma.storeBanner.create({
      data: {
        storeId: id,
        isGlobal: !!isGlobal,
        imageUrl: imageUrl || null,
        imageKey: imageKey || null,
        heading: heading || null,
        subheading: subheading || null,
        body: body || null,
      },
    });
    return NextResponse.json({ ok: true, banner }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
