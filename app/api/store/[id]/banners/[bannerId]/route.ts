import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

async function ownerCheck(storeId: string, userId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { ownerId: true } });
  return store?.ownerId === userId;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; bannerId: string }> }) {
  try {
    const { id, bannerId } = await params;
    const user = await getServerUser(req);
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (!(await ownerCheck(id, user.id))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

    const { isGlobal, imageUrl, imageKey, heading, subheading, body } = await req.json().catch(() => ({}));
    const banner = await prisma.storeBanner.update({
      where: { id: bannerId },
      data: {
        ...(isGlobal !== undefined && { isGlobal }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
        ...(imageKey !== undefined && { imageKey: imageKey || null }),
        ...(heading !== undefined && { heading: heading || null }),
        ...(subheading !== undefined && { subheading: subheading || null }),
        ...(body !== undefined && { body: body || null }),
      },
    });
    return NextResponse.json({ ok: true, banner });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; bannerId: string }> }) {
  try {
    const { id, bannerId } = await params;
    const user = await getServerUser(req);
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (!(await ownerCheck(id, user.id))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

    await prisma.storeBanner.delete({ where: { id: bannerId } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
