import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [store, user] = await Promise.all([
    prisma.store.findUnique({
      where: { id },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            subsections: {
              orderBy: { order: "asc" },
              include: {
                blocks: { orderBy: { order: "asc" } },
              },
            },
            blocks: {
              where: { subsectionId: null },
              orderBy: { order: "asc" },
            },
          },
        },
      },
    }),
    getServerUser(req),
  ]);

  if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ...store, isOwner: user?.id === store.ownerId });
}
