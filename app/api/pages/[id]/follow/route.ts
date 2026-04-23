// app/api/pages/[id]/follow/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

async function followerCount(pageId: string) {
  return prisma.pageFollow.count({ where: { pageId } });
}

export async function GET(req: Request, { params }: Ctx) {
  const pageId = params.id;
  try {
    const user = await getServerUser(req);
    const count = await followerCount(pageId);

    if (!user) {
      return NextResponse.json({ following: false, followerCount: count });
    }

    const existing = await prisma.pageFollow.findUnique({
      where: { userId_pageId: { userId: user.id, pageId } },
      select: { id: true },
    });

    return NextResponse.json({ following: !!existing, followerCount: count });
  } catch (err: any) {
    console.error("GET follow error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const pageId = params.id;
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { id: true },
    });
    if (!page) {
      return NextResponse.json({ error: "page_not_found" }, { status: 404 });
    }

    await prisma.pageFollow.create({
      data: { userId: user.id, pageId },
    });

    const count = await followerCount(pageId);
    return NextResponse.json({ following: true, followerCount: count }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      const count = await followerCount(pageId);
      return NextResponse.json({ following: true, followerCount: count });
    }
    console.error("POST follow error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const pageId = params.id;
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    await prisma.pageFollow.deleteMany({
      where: { userId: user.id, pageId },
    });

    const count = await followerCount(pageId);
    return NextResponse.json({ following: false, followerCount: count });
  } catch (err: any) {
    console.error("DELETE follow error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
