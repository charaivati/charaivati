// app/api/pages/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  // include owner to show owner name/email
  const page = await prisma.page.findUnique({
    where: { id },
    include: { owner: true },
  });

  if (!page) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const payload = {
    id: page.id,
    title: page.title,
    description: page.description ?? null,
    avatar: page.avatarUrl ?? null,
    status: page.status,
    owner: page.owner ? { id: page.owner.id, name: page.owner.name ?? null, avatar: page.owner.avatarUrl ?? null } : null,
    createdAt: page.createdAt?.toISOString?.() ?? null,
    updatedAt: page.updatedAt?.toISOString?.() ?? null,
  };

  return NextResponse.json(payload);
}
