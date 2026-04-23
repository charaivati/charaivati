import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();

  if (!q) return NextResponse.json({ ok: true, results: [] });

  const viewer = await getCurrentUser(request);

  const [users, pages] = await Promise.all([
    prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
          viewer?.id ? { id: { not: viewer.id } } : {},
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        profile: { select: { displayName: true } },
      },
      take: 10,
      orderBy: { name: "asc" },
    }),
    prisma.page.findMany({
      where: {
        status: "active",
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { healthBusiness: { specialty: { contains: q, mode: "insensitive" } } },
          { healthBusiness: { searchTags: { hasSome: [q] } } },
          { healthBusiness: { credentials: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        title: true,
        type: true,
        avatarUrl: true,
        healthBusiness: { select: { specialty: true } },
        _count: { select: { followers: true } },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const results = [
    ...users.map((u) => ({
      id: u.id,
      type: "person",
      name: u.profile?.displayName || u.name || u.email || "User",
      subtitle: u.email ?? undefined,
      avatarUrl: u.avatarUrl ?? null,
    })),
    ...pages.map((p) => ({
      type: "page" as const,
      id: p.id,
      title: p.title,
      pageType: p.type,
      specialty: p.healthBusiness?.specialty ?? null,
      avatarUrl: p.avatarUrl ?? null,
      followerCount: p._count.followers,
    })),
  ];

  return NextResponse.json({ ok: true, results });
}
