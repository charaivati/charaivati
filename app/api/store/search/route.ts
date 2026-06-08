import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json([]);

  const stores = await prisma.store.findMany({
    where: {
      name: { contains: q, mode: "insensitive" },
      ownerId: { not: user.id },
      deletedAt: null,
    },
    select: { id: true, name: true, slug: true, pageId: true },
    take: 10,
    orderBy: { name: "asc" },
  });

  return NextResponse.json(stores);
}
