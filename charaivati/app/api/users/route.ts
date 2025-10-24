// app/api/users/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";

  // Keep the select minimal to avoid typing issues. Include createdAt for joinedAt if needed.
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 50,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      // createdAt included to show joined date if you want
      createdAt: true,
      // NOTE: If your generated client has title/shortBio, add them here.
      // title: true,
      // shortBio: true,
    },
  });

  const mapped = users.map((u) => ({
    id: u.id,
    name: u.name ?? "",
    avatar: u.avatarUrl ?? null,
    // If title/shortBio are present in the DB/client, fill them; otherwise null
    title: (u as any).title ?? null,
    shortBio: (u as any).shortBio ?? null,
    joinedAt: u.createdAt?.toISOString?.() ?? null,
  }));

  return NextResponse.json(mapped);
}
