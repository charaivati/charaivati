import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ progress: [] });

  const url = new URL(req.url);
  const pageId = url.searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });

  const store = await prisma.store.findFirst({
    where: { pageId },
    include: {
      sections: {
        include: { blocks: { select: { id: true } } },
      },
    },
  });

  if (!store) return NextResponse.json({ progress: [] });

  const blockIds = store.sections.flatMap((s) => s.blocks.map((b) => b.id));
  const progress = await prisma.courseProgress.findMany({
    where: { userId: user.id, blockId: { in: blockIds } },
    select: { blockId: true, status: true, mastery: true },
  });

  return NextResponse.json({ progress });
}

export async function PATCH(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { blockId, status, mastery } = body;
  if (!blockId) return NextResponse.json({ error: "blockId required" }, { status: 400 });

  const progress = await prisma.courseProgress.upsert({
    where: { userId_blockId: { userId: user.id, blockId } },
    update: { status: status ?? "done", mastery: mastery ?? 100 },
    create: { userId: user.id, blockId, status: status ?? "done", mastery: mastery ?? 100 },
  });

  return NextResponse.json({ ok: true, progress });
}
