import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { resolveImage } from "@/lib/imageCache";

type ParsedItem = {
  title: string;
  description: string;
  price: number | null;
  searchQuery: string;
};

type ParsedSection = {
  title: string;
  items: ParsedItem[];
};

type ResolvedItem = ParsedItem & {
  imageUrl: string;
  imageProvider: string;
  imageQuality: number;
};

async function resolveInBatches(
  queries: string[],
  concurrency: number
): Promise<Array<{ url: string; provider: string; quality: number }>> {
  const results: Array<{ url: string; provider: string; quality: number }> = [];
  for (let i = 0; i < queries.length; i += concurrency) {
    const batch = queries.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(q => resolveImage(q)));
    results.push(...batchResults);
  }
  return results;
}

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.storeId || !body?.parsed?.sections?.length) {
    return NextResponse.json({ error: "storeId and parsed.sections required" }, { status: 400 });
  }

  const { storeId, parsed } = body as {
    storeId: string;
    parsed: { sections: ParsedSection[] };
  };

  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { ownerId: true, name: true } });
  if (!store || store.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Flatten all items in order so we can do a single batched resolution pass
  const allItems: Array<{ sectionIdx: number; itemIdx: number; query: string }> = [];
  for (let si = 0; si < parsed.sections.length; si++) {
    for (let ii = 0; ii < (parsed.sections[si].items ?? []).length; ii++) {
      allItems.push({
        sectionIdx: si,
        itemIdx: ii,
        query: parsed.sections[si].items[ii].searchQuery || parsed.sections[si].items[ii].title,
      });
    }
  }

  // Items 0 and 1 resolved first (priority), then the rest in batches of 5
  const priorityCount = Math.min(2, allItems.length);
  const priorityQueries = allItems.slice(0, priorityCount).map(i => i.query);
  const restQueries     = allItems.slice(priorityCount).map(i => i.query);

  const [priorityImages, restImages] = await Promise.all([
    resolveInBatches(priorityQueries, priorityCount || 1),
    resolveInBatches(restQueries, 5),
  ]);

  const allImages = [...priorityImages, ...restImages];

  // Map resolved images back to sections
  const resolvedSections: Array<{ title: string; items: ResolvedItem[] }> = parsed.sections.map(s => ({
    title: s.title,
    items: (s.items ?? []).map(item => ({ ...item, imageUrl: "", imageProvider: "picsum", imageQuality: 0 })),
  }));

  for (let i = 0; i < allItems.length; i++) {
    const { sectionIdx, itemIdx } = allItems[i];
    const img = allImages[i];
    resolvedSections[sectionIdx].items[itemIdx].imageUrl      = img.url;
    resolvedSections[sectionIdx].items[itemIdx].imageProvider = img.provider;
    resolvedSections[sectionIdx].items[itemIdx].imageQuality  = img.quality;
  }

  // Build sections in the same shape expected by ai-setup/apply but call Prisma directly
  let sectionCount = 0;
  let blockCount   = 0;

  try {
    await prisma.$transaction(async (tx) => {
      for (let si = 0; si < resolvedSections.length; si++) {
        const section = resolvedSections[si];
        const itemCount = section.items.length;
        const layout = itemCount <= 1 ? "1" : itemCount === 2 ? "1-1" : "1-1-1";
        const colMap: Record<string, number> = { "1": 1, "1-1": 2, "1-1-1": 3 };

        const createdSection = await tx.storeSection.create({
          data: {
            storeId,
            title: section.title,
            columns: colMap[layout] ?? 1,
            rows: 1,
            rowIndex: si,
            order: si,
            type: "grid",
            sectionType: "product",
          },
        });
        sectionCount++;

        for (let ii = 0; ii < section.items.length; ii++) {
          const item = section.items[ii];
          await tx.storeBlock.create({
            data: {
              sectionId:     createdSection.id,
              title:         item.title,
              description:   item.description || null,
              price:         item.price ?? null,
              mediaType:     "image",
              mediaUrl:      item.imageUrl || null,
              actionType:    "buy",
              order:         ii,
              imageProvider: item.imageProvider,
              imageQuality:  item.imageQuality,
            },
          });
          blockCount++;
        }
      }

      // Global banner using the first product image
      const firstImage = resolvedSections
        .flatMap(s => s.items)
        .find(i => i.imageUrl)?.imageUrl ?? null;

      if (firstImage) {
        await tx.storeBanner.create({
          data: {
            storeId,
            isGlobal: true,
            imageUrl: firstImage,
            heading: store.name,
          },
        });
      }
    }, { timeout: 30_000 });
  } catch (err) {
    console.error("[parse-menu/apply] transaction failed:", err);
    return NextResponse.json({ error: "Failed to create store structure" }, { status: 500 });
  }

  return NextResponse.json({ success: true, sectionCount, blockCount });
}
