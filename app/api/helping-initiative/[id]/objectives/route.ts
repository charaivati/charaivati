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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const objectives = await prisma.helpingObjective.findMany({
    where: { initiativeId: id },
    orderBy: { order: "asc" },
    include: { actions: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json({ ok: true, objectives });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getServerUser(req);
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (!(await ownerCheck(id, user.id))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

    const { title } = await req.json().catch(() => ({}));
    if (!title?.trim()) return NextResponse.json({ error: "title_required" }, { status: 400 });

    const count = await prisma.helpingObjective.count({ where: { initiativeId: id } });
    const objective = await prisma.helpingObjective.create({
      data: { initiativeId: id, title: title.trim(), order: count },
      include: { actions: true },
    });
    return NextResponse.json({ ok: true, objective }, { status: 201 });
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

    const { objectiveId, title } = await req.json().catch(() => ({}));
    if (!objectiveId) return NextResponse.json({ error: "objectiveId_required" }, { status: 400 });

    const updated = await prisma.helpingObjective.update({
      where: { id: objectiveId },
      data: { ...(title !== undefined && { title }) },
    });
    return NextResponse.json({ ok: true, objective: updated });
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

    const { objectiveId } = await req.json().catch(() => ({}));
    if (!objectiveId) return NextResponse.json({ error: "objectiveId_required" }, { status: 400 });

    await prisma.helpingObjective.delete({ where: { id: objectiveId } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
