import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const stores = await prisma.store.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      sections: {
        take: 1,
        include: {
          tiles: {
            take: 1,
            orderBy: { order: "asc" },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    stores: stores.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      previewImage: s.sections[0]?.tiles[0]?.imageUrl ?? null,
    })),
  });
}
