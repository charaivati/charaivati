import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { generateSlug, randomSuffix } from "@/lib/store/generateSlug";

// PATCH /api/store/[id]/restore — owner-gated. Reverses softDeleteStore: clears
// Store.deletedAt and the linked Page.deletedAt. Collaborations ended at delete
// time are NOT re-activated (KNOWN GAP — owner must re-invite partners manually).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = await prisma.store.findUnique({
    where: { id },
    select: { id: true, ownerId: true, deletedAt: true, pageId: true, name: true },
  });
  if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (store.ownerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!store.deletedAt) return NextResponse.json({ error: "not_deleted", message: "This store is already active." }, { status: 400 });

  // Slug may have been claimed by a different store while this one was deleted —
  // mint a fresh unique slug rather than blocking the restore outright.
  const slugRows = await prisma.$queryRaw<{ slug: string | null }[]>`
    SELECT slug FROM "Store" WHERE id = ${id} LIMIT 1
  `;
  let slug = slugRows[0]?.slug ?? null;
  let slugChanged = false;

  if (slug) {
    const conflictRows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Store" WHERE slug = ${slug} AND id != ${id} AND "deletedAt" IS NULL LIMIT 1
    `;
    if (conflictRows[0]) {
      slug = `${generateSlug(store.name)}-${randomSuffix()}`;
      slugChanged = true;
      await prisma.$executeRaw`UPDATE "Store" SET slug = ${slug} WHERE id = ${id}`;
    }
  }

  await prisma.$transaction([
    prisma.store.update({ where: { id: store.id }, data: { deletedAt: null } }),
    ...(store.pageId ? [prisma.page.update({ where: { id: store.pageId }, data: { deletedAt: null } })] : []),
  ]);

  return NextResponse.json({ ok: true, slug, slugChanged });
}
