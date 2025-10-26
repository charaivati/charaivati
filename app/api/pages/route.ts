// app/api/pages/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";

  const pages = await prisma.page.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 50,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      avatarUrl: true,
      ownerId: true,
      status: true,
      createdAt: true,
    },
  });

  const mapped = pages.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description ?? null,
    avatar: p.avatarUrl ?? null,
    ownerId: p.ownerId ?? null,
    status: p.status,
    createdAt: p.createdAt?.toISOString?.() ?? null,
  }));

  return NextResponse.json(mapped);
}
