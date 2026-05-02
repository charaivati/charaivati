import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { pageId, courseType, dominantAspect, aspectWeights, aspectBenefits } = body;

  if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });

  const page = await prisma.page.findUnique({ where: { id: pageId }, select: { ownerId: true } });
  if (!page || page.ownerId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const course = await prisma.course.create({
    data: {
      pageId,
      courseType: courseType ?? "skill",
      dominantAspect: dominantAspect ?? "mental",
      aspectWeights: aspectWeights ?? { physical: 33, mental: 34, emotional: 33 },
      aspectBenefits: aspectBenefits ?? {},
    },
  });

  return NextResponse.json({ ok: true, course }, { status: 201 });
}
