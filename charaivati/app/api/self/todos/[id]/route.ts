// app/api/self/todos/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromReq } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string }}) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  const body = await req.json();
  const { title, freq, completed } = body;

  const updated = await prisma.todo.updateMany({
    where: { id, userId: user.id },
    data: { title, freq, completed },
  });
  const todo = await prisma.todo.findUnique({ where: { id }});
  return NextResponse.json({ todo });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string }}) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  await prisma.todo.deleteMany({ where: { id, userId: user.id }});
  return NextResponse.json({ success: true });
}
