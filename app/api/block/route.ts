import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sectionId, subsectionId, title, description, mediaType, mediaUrl, actionType, price,
    aspect, lessonType, blockStatus } =
    await req.json();

  if (!title?.trim())
    return NextResponse.json({ error: "title required" }, { status: 400 });
  if (!sectionId && !subsectionId)
    return NextResponse.json({ error: "sectionId or subsectionId required" }, { status: 400 });

  // Verify ownership via the section → store chain
  if (sectionId) {
    const section = await prisma.storeSection.findUnique({
      where: { id: sectionId },
      include: { store: true },
    });
    if (!section || section.store.ownerId !== user.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const maxOrder = await prisma.storeBlock.aggregate({
    where: sectionId ? { sectionId } : { subsectionId },
    _max: { order: true },
  });

  const block = await prisma.storeBlock.create({
    data: {
      sectionId: sectionId ?? null,
      subsectionId: subsectionId ?? null,
      title: title.trim(),
      description: description?.trim() ?? null,
      mediaType: mediaType ?? "image",
      mediaUrl: mediaUrl?.trim() ?? null,
      actionType: actionType ?? "view",
      price: price != null ? Number(price) : null,
      order: (maxOrder._max.order ?? -1) + 1,
      aspect: aspect ?? null,
      lessonType: lessonType ?? null,
      blockStatus: blockStatus ?? "unlocked",
    },
  });

  return NextResponse.json(block, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { blockId } = body;
  if (!blockId) return NextResponse.json({ error: "blockId required" }, { status: 400 });

  const block = await prisma.storeBlock.findUnique({
    where: { id: blockId },
    include: { section: { include: { store: true } } },
  });
  if (!block || block.section?.store.ownerId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const allowed = ["title", "description", "aspect", "lessonType", "mediaType", "mediaUrl", "blockStatus", "lessonTags", "access"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key] ?? null;
  }
  if (typeof data.title === "string") data.title = (data.title as string).trim();
  if (typeof data.description === "string") data.description = (data.description as string).trim() || null;

  let updated = await prisma.storeBlock.update({
    where: { id: blockId },
    data,
    include: { section: { include: { store: true } } },
  });

  // Auto-create or update a linked feed post when media is present
  try {
    const hasMedia = !!(updated.mediaUrl);
    const mediaChanged = "mediaUrl" in body || "access" in body;
    const existingPostId = (updated as any).linkedPostId ?? null;

    if (hasMedia && mediaChanged) {
      const storePageId = (updated as any).section?.store?.pageId ?? null;
      if (storePageId) {
        const isYT = /youtube\.com|youtu\.be/.test(updated.mediaUrl ?? "");
        const isVid = updated.mediaType === "video";
        const accessVal = (updated as any).access ?? "free";
        const visibility = accessVal === "premium" ? "private" : accessVal === "friends" ? "friends" : "public";
        const lessonTagsArr = Array.isArray((updated as any).lessonTags) ? (updated as any).lessonTags : [];

        const postData = {
          videoUrl: !isYT && isVid ? updated.mediaUrl : null,
          youtubeLinks: isYT ? [updated.mediaUrl!] : [],
          slugTags: lessonTagsArr,
          visibility,
        };

        let resolvedPostId: string | null = null;

        if (existingPostId) {
          // Verify the linked post still exists — it may have been deleted from the profile
          const stillExists = await prisma.post.findUnique({ where: { id: existingPostId }, select: { id: true } });
          if (stillExists) {
            await prisma.post.update({ where: { id: existingPostId }, data: postData });
            resolvedPostId = existingPostId;
          } else {
            // Stale reference: create a fresh post and clear the dead linkedPostId
            const post = await prisma.post.create({
              data: { userId: user.id, pageId: storePageId, content: updated.title, imageUrls: [], imageFileIds: [], ...postData },
            });
            resolvedPostId = post.id;
          }
        } else {
          const post = await prisma.post.create({
            data: { userId: user.id, pageId: storePageId, content: updated.title, imageUrls: [], imageFileIds: [], ...postData },
          });
          resolvedPostId = post.id;
        }

        if (resolvedPostId !== existingPostId || (updated as any).blockStatus === "media_deleted") {
          await prisma.storeBlock.update({
            where: { id: blockId },
            data: {
              linkedPostId: resolvedPostId,
              ...(((updated as any).blockStatus === "media_deleted") && { blockStatus: "unlocked" }),
            },
          });
          (updated as any).linkedPostId = resolvedPostId;
          if ((updated as any).blockStatus === "media_deleted") (updated as any).blockStatus = "unlocked";
        }
      }
    } else if (!hasMedia && "access" in body && existingPostId) {
      // Sync visibility when access changes but no media change
      const accessVal = (updated as any).access ?? "free";
      const visibility = accessVal === "premium" ? "private" : accessVal === "friends" ? "friends" : "public";
      await prisma.post.update({ where: { id: existingPostId }, data: { visibility } });
    }
  } catch (postErr) {
    console.error("[block PATCH] auto-post sync failed (non-fatal):", postErr);
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blockId } = await req.json().catch(() => ({}));
  if (!blockId) return NextResponse.json({ error: "blockId required" }, { status: 400 });

  const block = await prisma.storeBlock.findUnique({
    where: { id: blockId },
    include: { section: { include: { store: true } } },
  });
  if (!block || block.section?.store.ownerId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.storeBlock.delete({ where: { id: blockId } });
  return NextResponse.json({ ok: true });
}
