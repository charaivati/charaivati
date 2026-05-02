import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await params;

  const [course, store, user] = await Promise.all([
    prisma.course.findUnique({
      where: { pageId },
      include: {
        page: { select: { id: true, title: true, description: true, pageType: true } },
      },
    }),
    prisma.store.findFirst({
      where: { pageId },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            blocks: {
              where: { subsectionId: null },
              orderBy: { order: "asc" },
              select: {
                id: true,
                title: true,
                description: true,
                mediaType: true,
                mediaUrl: true,
                actionType: true,
                price: true,
                order: true,
                aspect: true,
                lessonType: true,
                blockStatus: true,
                mastery: true,
                access: true,
                linkedPostId: true,
              },
            },
          },
        },
      },
    }),
    getServerUser(req),
  ]);

  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let progress: { blockId: string; status: string; mastery: number }[] = [];
  if (user && store) {
    const blockIds = store.sections.flatMap((s) => s.blocks.map((b) => b.id));
    const rows = await prisma.courseProgress.findMany({
      where: { userId: user.id, blockId: { in: blockIds } },
      select: { blockId: true, status: true, mastery: true },
    });
    progress = rows;
  }

  return NextResponse.json({ ...course, store, progress });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const course = await prisma.course.findUnique({ where: { pageId }, select: { page: { select: { ownerId: true } } } });
  if (!course || course.page.ownerId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (Array.isArray(body.courseTags)) data.courseTags = body.courseTags;
  if (body.courseType !== undefined) data.courseType = body.courseType;
  if (body.aspectBenefits !== undefined) data.aspectBenefits = body.aspectBenefits;

  const updated = await prisma.course.update({ where: { pageId }, data });
  return NextResponse.json(updated);
}
