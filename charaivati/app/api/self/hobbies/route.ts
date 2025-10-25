// app/api/self/hobbies/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/session"; // your helper

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const hobbies = await db.hobby.findMany({
    where: { userId: user.id },
    include: { todos: { orderBy: { createdAt: "desc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ ok: true, data: hobbies });
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ ok: false, error: "Missing title" }, { status: 400 });

  try {
    const hobby = await db.hobby.create({
      data: { userId: user.id, title, description: body.description ?? null },
    });
    return NextResponse.json({ ok: true, data: hobby }, { status: 201 });
  } catch (err: any) {
    // unique constraint handling
    if (err?.code === "P2002") {
      return NextResponse.json({ ok: false, error: "Hobby already exists" }, { status: 409 });
    }
    console.error("create hobby error", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
