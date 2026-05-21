// app/api/pages/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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
    pageType: page.pageType,
    owner: page.owner ? { id: page.owner.id, name: page.owner.name ?? null, avatar: page.owner.avatarUrl ?? null } : null,
    createdAt: page.createdAt?.toISOString?.() ?? null,
    updatedAt: page.updatedAt?.toISOString?.() ?? null,
  };

  return NextResponse.json(payload);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const page = await prisma.page.findUnique({ where: { id }, select: { ownerId: true } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (page.ownerId !== payload.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { description } = body;

  const updated = await prisma.page.update({
    where: { id },
    data: { ...(description !== undefined && { description: description ?? null }) },
    select: { id: true, description: true },
  });
  return NextResponse.json(updated);
}
