// app/api/users/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session"; // adjust import if needed

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";

    // Get current user to exclude from results
    const currentUser = await getCurrentUser(req);

    // Keep the select minimal to avoid typing issues
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
          // Exclude current user
          currentUser ? { id: { not: currentUser.id } } : {},
        ],
      },
      take: 50,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    const mapped = users.map((u) => ({
      id: u.id,
      name: u.name ?? "",
      avatar: u.avatarUrl ?? null,
      title: (u as any).title ?? null,
      shortBio: (u as any).shortBio ?? null,
      joinedAt: u.createdAt?.toISOString?.() ?? null,
    }));

    return NextResponse.json(mapped);
  } catch (err: any) {
    console.error("GET /api/users error:", err);
    return NextResponse.json([], { status: 500 });
  }
}