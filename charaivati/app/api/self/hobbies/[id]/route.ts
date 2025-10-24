// app/api/self/hobbies/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromReq } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string }}) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  const body = await req.json();
  const { title, description } = body;

  const hobby = await prisma.hobby.updateMany({
    where: { id, userId: user.id },
    data: { title, description },
  });
  // updateMany returns count; fetch updated object
  const updated = await prisma.hobby.findUnique({ where: { id } });
  return NextResponse.json({ hobby: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string }}) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  await prisma.hobby.deleteMany({ where: { id, userId: user.id }});
  return NextResponse.json({ success: true });
}
