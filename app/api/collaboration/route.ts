import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { createNotification } from "@/lib/notifications/createNotification";

const PAGE_SELECT = {
  id: true,
  title: true,
  pageType: true,
  avatarUrl: true,
} as const;

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requesterId, receiverId, role, message } = await req.json();

  if (!requesterId || !receiverId || !role) {
    return NextResponse.json({ error: "requesterId, receiverId, and role are required" }, { status: 400 });
  }

  const [requesterPage, receiverPageDirect] = await Promise.all([
    prisma.page.findUnique({ where: { id: requesterId }, select: { ownerId: true, title: true } }),
    prisma.page.findUnique({ where: { id: receiverId },  select: { id: true } }),
  ]);
  if (!requesterPage) return NextResponse.json({ error: "Requester page not found" }, { status: 404 });
  if (requesterPage.ownerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // If the caller passed a Store ID or slug instead of a Page ID, resolve it automatically.
  let resolvedReceiverId = receiverId;
  if (!receiverPageDirect) {
    const store = await prisma.store.findFirst({
      where: {
        OR: [
          { id: receiverId },
          { slug: receiverId },
        ],
        deletedAt: null,
      },
      select: { pageId: true },
    });
    if (store?.pageId) {
      resolvedReceiverId = store.pageId;
    } else {
      return NextResponse.json(
        { error: "Receiver not found — paste the page ID or store ID/slug from the store URL" },
        { status: 404 }
      );
    }
  }

  const existing = await prisma.collaboration.findFirst({
    where: { requesterId, receiverPageId: resolvedReceiverId, role },
  });
  if (existing) return NextResponse.json({ error: "Collaboration request already exists" }, { status: 409 });

  const collaboration = await prisma.collaboration.create({
    data: {
      requesterId,
      receiverPageId: resolvedReceiverId,
      role,
      message: message ?? null,
      status: "pending",
    },
  });

  // Notify the invited party — fire-and-forget, never fails the request.
  prisma.page
    .findUnique({ where: { id: resolvedReceiverId }, select: { ownerId: true } })
    .then((receiverPage) => {
      if (!receiverPage?.ownerId) return;
      return createNotification({
        userId: receiverPage.ownerId,
        type:   "collaboration_request",
        title:  `${requesterPage.title} wants to partner with you`,
        body:   `New ${role.replace(/_/g, " ")} request${message ? `: "${message}"` : ""}`,
        link:   `/earn/initiative/${resolvedReceiverId}?tab=partners`,
      });
    })
    .catch((e) => console.error("collaboration_request notification failed:", e));

  return NextResponse.json(collaboration, { status: 201 });
}

export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const pageId = searchParams.get("pageId");
  const direction = searchParams.get("direction") ?? "out";
  const statusFilter = searchParams.get("status") ?? "all";

  if (!pageId) return NextResponse.json({ error: "pageId is required" }, { status: 400 });

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { ownerId: true },
  });
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
  if (page.ownerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const where: Record<string, unknown> = direction === "in" ? { receiverPageId: pageId } : { requesterId: pageId };
  if (statusFilter !== "all") where.status = statusFilter;

  const collaborations = await prisma.collaboration.findMany({
    where,
    include: {
      requester:    { select: PAGE_SELECT },
      receiverPage: { select: PAGE_SELECT },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(collaborations);
}
