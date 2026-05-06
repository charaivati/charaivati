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
  const metrics = await prisma.helpingMetric.findMany({
    where: { initiativeId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ ok: true, metrics });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getServerUser(req);
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (!(await ownerCheck(id, user.id))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

    const { label, targetNumber, unit } = await req.json().catch(() => ({}));
    if (!label?.trim()) return NextResponse.json({ error: "label_required" }, { status: 400 });

    const metric = await prisma.helpingMetric.create({
      data: { initiativeId: id, label: label.trim(), targetNumber: Number(targetNumber) || 0, unit: unit || null },
    });
    return NextResponse.json({ ok: true, metric }, { status: 201 });
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

    const { metricId, label, targetNumber, currentNumber, unit } = await req.json().catch(() => ({}));
    if (!metricId) return NextResponse.json({ error: "metricId_required" }, { status: 400 });

    const updated = await prisma.helpingMetric.update({
      where: { id: metricId },
      data: {
        ...(label !== undefined && { label }),
        ...(targetNumber !== undefined && { targetNumber: Number(targetNumber) }),
        ...(currentNumber !== undefined && { currentNumber: Number(currentNumber) }),
        ...(unit !== undefined && { unit }),
      },
    });
    return NextResponse.json({ ok: true, metric: updated });
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

    const { metricId } = await req.json().catch(() => ({}));
    if (!metricId) return NextResponse.json({ error: "metricId_required" }, { status: 400 });

    await prisma.helpingMetric.delete({ where: { id: metricId } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
