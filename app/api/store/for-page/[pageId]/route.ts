import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

// GET /api/store/for-page/[pageId]
// Returns the store for this page, creating one if it doesn't exist yet.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;

  // Look up the page to get its title and verify ownership
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { id: true, title: true, description: true, ownerId: true },
  });

  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
  if (page.ownerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Find or create the store for this page
  let store = await prisma.store.findUnique({ where: { pageId } });

  if (!store) {
    store = await prisma.store.create({
      data: {
        name: page.title,
        description: page.description ?? null,
        ownerId: user.id,
        pageId,
      },
    });
  }

  return NextResponse.json({ storeId: store.id });
}
