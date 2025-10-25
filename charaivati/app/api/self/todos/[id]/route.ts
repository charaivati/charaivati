// app/api/self/todos/[id]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/session";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = params.id;
  const body = await req.json().catch(() => ({}));

  try {
    const updated = await db.todo.updateMany({
      where: { id, userId: user.id },
      data: {
        title: body.title ?? undefined,
        freq: body.freq ?? undefined,
        completed: typeof body.completed === "boolean" ? body.completed : undefined,
      },
    });
    if (updated.count === 0) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("update todo error", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = params.id;
  try {
    await db.todo.deleteMany({ where: { id, userId: user.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete todo error", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
