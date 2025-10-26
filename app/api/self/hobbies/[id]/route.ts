// app/api/self/hobbies/[id]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/session";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = params.id;
  const body = await req.json().catch(() => ({}));
  try {
    const hobby = await db.hobby.updateMany({
      where: { id, userId: user.id },
      data: { title: body.title ?? undefined, description: body.description ?? undefined },
    });
    if (hobby.count === 0) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("update hobby error", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = params.id;
  try {
    // OPTION: soft-delete by setting deletedAt instead of hard delete (if added)
    await db.hobby.deleteMany({ where: { id, userId: user.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete hobby error", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
