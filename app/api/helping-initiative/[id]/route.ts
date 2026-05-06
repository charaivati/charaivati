import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const initiative = await prisma.helpingInitiative.findUnique({
      where: { id },
      include: {
        objectives: {
          orderBy: { order: "asc" },
          include: { actions: { orderBy: { order: "asc" } } },
        },
        metrics: { orderBy: { createdAt: "asc" } },
        page: { select: { title: true, ownerId: true, owner: { select: { name: true, avatarUrl: true } } } },
      },
    });
    if (!initiative) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, initiative });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getServerUser(req);
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const initiative = await prisma.helpingInitiative.findUnique({
      where: { id },
      select: { page: { select: { ownerId: true } } },
    });
    if (!initiative) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (initiative.page.ownerId !== user.id) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { cause, targetGroup, location, awarenessText, acceptDonations, donationMessage } = body;

    const updated = await prisma.helpingInitiative.update({
      where: { id },
      data: {
        ...(cause !== undefined && { cause }),
        ...(targetGroup !== undefined && { targetGroup }),
        ...(location !== undefined && { location }),
        ...(awarenessText !== undefined && { awarenessText }),
        ...(acceptDonations !== undefined && { acceptDonations }),
        ...(donationMessage !== undefined && { donationMessage }),
      },
    });
    return NextResponse.json({ ok: true, initiative: updated });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
