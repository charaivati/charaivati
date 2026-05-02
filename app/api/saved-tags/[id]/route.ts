import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const tagSet = await prisma.savedTagSet.findUnique({ where: { id }, select: { userId: true } });
  if (!tagSet || tagSet.userId !== user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.savedTagSet.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
