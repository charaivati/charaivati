// app/api/self/hobbies/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromReq } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hobbies = await prisma.hobby.findMany({
    where: { userId: user.id },
    include: { todos: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ hobbies });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, description } = body;
  if (!title || !title.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

  // Avoid duplicate per user (unique constraint)
  const existing = await prisma.hobby.findFirst({ where: { userId: user.id, title }});
  if (existing) return NextResponse.json({ hobby: existing });

  const hobby = await prisma.hobby.create({
    data: { userId: user.id, title, description },
  });
  return NextResponse.json({ hobby });
}
