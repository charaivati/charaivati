// app/api/circles/[id]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const circle = await db.friendCircle.findUnique({ where: { id: params.id } });
  if (!circle || circle.ownerId !== user.id)
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const label = body.label !== undefined ? String(body.label).trim() : undefined;
  const color = body.color !== undefined ? String(body.color).trim() : undefined;

  if (label === "") return NextResponse.json({ ok: false, error: "Label cannot be empty" }, { status: 400 });

  const updated = await db.friendCircle.update({
    where: { id: params.id },
    data: {
      ...(label ? { label } : {}),
      ...(color ? { color } : {}),
    },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatarUrl: true, profile: { select: { displayName: true } } } } },
      },
    },
  });

  return NextResponse.json({ ok: true, circle: updated });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const circle = await db.friendCircle.findUnique({ where: { id: params.id } });
  if (!circle || circle.ownerId !== user.id)
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  if (circle.isDefault)
    return NextResponse.json({ ok: false, error: "Cannot delete default circles" }, { status: 400 });

  await db.friendCircle.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
