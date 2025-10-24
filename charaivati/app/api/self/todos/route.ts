// app/api/self/todos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromReq } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hobbyId, title, freq } = await req.json();
  if (!title || !title.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const todo = await prisma.todo.create({
    data: {
      userId: user.id,
      hobbyId: hobbyId ?? null,
      title,
      freq: freq ?? null,
    },
  });
  return NextResponse.json({ todo });
}
