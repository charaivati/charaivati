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
  concurrency: number,
  allowUnsplash: boolean
): Promise<Array<{ url: string; provider: string; quality: number }>> {
  const results: Array<{ url: string; provider: string; quality: number }> = [];
  for (let i = 0; i < queries.length; i += concurrency) {
    const batch = queries.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(q => resolveImage(q, { allowUnsplash }))
    );
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
    parsed: { sections: ParsedSection[]; hours?: string };
  };

  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { ownerId: true, name: true } });
  if (!store || store.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Flatten all items in order
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

  const priorityCount = Math.min(2, allItems.length);

  // Product items → free providers only (Pexels/Pixabay/Picsum)
  // Section banners + global banner → Unsplash (high-visibility slots)
  // All four fetches run in parallel.
  const [priorityImages, restImages, sectionImages, globalBannerImg] = await Promise.all([
    resolveInBatches(allItems.slice(0, priorityCount).map(i => i.query), priorityCount || 1, false),
    resolveInBatches(allItems.slice(priorityCount).map(i => i.query), 5, false),
    Promise.all(parsed.sections.map(s => resolveImage(s.title, { allowUnsplash: true }))),
    resolveImage(store.name ?? "restaurant food", { allowUnsplash: true }),
  ]);

  const allImages = [...priorityImages, ...restImages];

  // Map resolved item images back to sections
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

        // One tile per section so the store main page shows an image instead of a grey placeholder
        await tx.sectionTile.create({
          data: { sectionId: createdSection.id, label: section.title, imageUrl: sectionImages[si].url, order: 0 },
        });

        // One filter + Unsplash banner per section — mirrors what ai-setup/apply does
        const filter = await tx.storeFilter.create({
          data: { storeId, name: section.title, order: si + 1 },
        });
        const sectionBanner = await tx.storeBanner.create({
          data: {
            storeId,
            isGlobal: false,
            imageUrl: sectionImages[si].url,
            heading: section.title,
          },
        });
        await tx.storeFilter.update({
          where: { id: filter.id },
          data: { bannerId: sectionBanner.id },
        });
        await tx.storeSectionFilter.create({
          data: { sectionId: createdSection.id, filterId: filter.id },
        });

        // Product blocks — free images (Pexels/Pixabay/Picsum)
        for (let ii = 0; ii < section.items.length; ii++) {
          const item = section.items[ii];
          await tx.storeBlock.create({
            data: {
              sectionId:     createdSection.id,
              storeId,
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

      // Global banner — dedicated Unsplash image keyed on the store name
      await tx.storeBanner.create({
        data: {
          storeId,
          isGlobal: true,
          imageUrl: globalBannerImg.url,
          heading: store.name,
        },
      });
    }, { timeout: 30_000 });
  } catch (err) {
    console.error("[parse-menu/apply] transaction failed:", err);
    return NextResponse.json({ error: "Failed to create store structure" }, { status: 500 });
  }

  if (parsed.hours?.trim()) {
    await prisma.$executeRaw`
      UPDATE "Store" SET "hoursText" = ${parsed.hours.trim()} WHERE id = ${storeId}
    `;
  }

  return NextResponse.json({ success: true, sectionCount, blockCount });
}
