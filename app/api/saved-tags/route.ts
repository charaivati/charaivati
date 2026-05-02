import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ ok: true, tagSets: [] });

  const tagSets = await prisma.savedTagSet.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, tags: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, tagSets });
}

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = (body.name || "").trim();
  const tags: string[] = Array.isArray(body.tags) ? body.tags.filter(Boolean) : [];

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (tags.length === 0) return NextResponse.json({ error: "tags required" }, { status: 400 });

  const tagSet = await prisma.savedTagSet.create({
    data: { userId: user.id, name, tags },
    select: { id: true, name: true, tags: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, tagSet }, { status: 201 });
}
