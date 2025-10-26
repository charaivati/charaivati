// app/api/self/todos/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/session";

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const hobbyId = url.searchParams.get("hobbyId");

  const where: any = { userId: user.id };
  if (hobbyId) where.hobbyId = hobbyId;

  const todos = await db.todo.findMany({ where, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ ok: true, data: todos });
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ ok: false, error: "Missing title" }, { status: 400 });

  const hobbyId = body.hobbyId ?? null;

  try {
    const todo = await db.todo.create({
      data: {
        userId: user.id,
        title,
        freq: body.freq ?? null,
        hobbyId,
      },
    });
    return NextResponse.json({ ok: true, data: todo }, { status: 201 });
  } catch (err) {
    console.error("create todo error", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
