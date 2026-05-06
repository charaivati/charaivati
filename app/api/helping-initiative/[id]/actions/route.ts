import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

async function ownerCheck(initiativeId: string, userId: string) {
  const initiative = await prisma.helpingInitiative.findUnique({
    where: { id: initiativeId },
    select: { page: { select: { ownerId: true } } },
  });
  return initiative?.page.ownerId === userId;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getServerUser(req);
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (!(await ownerCheck(id, user.id))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

    const { objectiveId, title } = await req.json().catch(() => ({}));
    if (!objectiveId || !title?.trim()) return NextResponse.json({ error: "objectiveId_and_title_required" }, { status: 400 });

    const count = await prisma.helpingAction.count({ where: { objectiveId } });
    const action = await prisma.helpingAction.create({
      data: { objectiveId, title: title.trim(), order: count },
    });
    return NextResponse.json({ ok: true, action }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getServerUser(req);
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (!(await ownerCheck(id, user.id))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

    const { actionId, title } = await req.json().catch(() => ({}));
    if (!actionId) return NextResponse.json({ error: "actionId_required" }, { status: 400 });

    const updated = await prisma.helpingAction.update({
      where: { id: actionId },
      data: { ...(title !== undefined && { title }) },
    });
    return NextResponse.json({ ok: true, action: updated });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getServerUser(req);
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (!(await ownerCheck(id, user.id))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

    const { actionId } = await req.json().catch(() => ({}));
    if (!actionId) return NextResponse.json({ error: "actionId_required" }, { status: 400 });

    await prisma.helpingAction.delete({ where: { id: actionId } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
