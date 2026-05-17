import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeId, filters, sections } = await req.json();
  if (!storeId || !sections?.length)
    return NextResponse.json({ error: "storeId and sections required" }, { status: 400 });

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store || store.ownerId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const results = await prisma.$transaction(async (tx) => {
      const createdSections = [];

      const filterNames = (filters ?? []).filter((f: string) => f !== "All");
      const createdFilters = await Promise.all(
        filterNames.map((name: string, i: number) =>
          tx.storeFilter.create({
            data: { storeId, name, order: i + 1 },
          })
        )
      );

      const filterMap = Object.fromEntries(
        createdFilters.map((f) => [f.name, f.id])
      );

      for (let si = 0; si < sections.length; si++) {
        const section = sections[si];

        const colMap: Record<string, number> = { "1": 1, "1-1": 2, "1-1-1": 3 };
        const columns = colMap[section.layout] ?? 1;

        const createdSection = await tx.storeSection.create({
          data: {
            storeId,
            title: section.title,
            columns,
            rows: 1,
            rowIndex: si,
            order: si,
            type: "grid",
            sectionType: "product",
          },
        });

        if (section.filter && section.filter !== "All" && filterMap[section.filter]) {
          await tx.storeSectionFilter.create({
            data: {
              sectionId: createdSection.id,
              filterId: filterMap[section.filter],
            },
          });
        }

        const tiles = section.tiles ?? [];
        for (let ti = 0; ti < tiles.length; ti++) {
          await tx.sectionTile.create({
            data: {
              sectionId: createdSection.id,
              label: tiles[ti].label,
              imageUrl: section.imageUrl ?? null,
              order: ti,
            },
          });
        }

        if (section.imageUrl) {
          const banner = await tx.storeBanner.create({
            data: {
              storeId,
              isGlobal: false,
              imageUrl: section.imageUrl,
              heading: section.title,
            },
          });
          if (section.filter && section.filter !== "All" && filterMap[section.filter]) {
            await tx.storeFilter.update({
              where: { id: filterMap[section.filter] },
              data: { bannerId: banner.id },
            });
          }
        }

        const products = section.products ?? [];
        for (let pi = 0; pi < products.length; pi++) {
          await tx.storeBlock.create({
            data: {
              sectionId: createdSection.id,
              title: products[pi].title,
              description: products[pi].description,
              price: products[pi].price ?? null,
              mediaType: "image",
              actionType: "buy",
              order: pi,
            },
          });
        }

        createdSections.push(createdSection);
      }

      // Global banner — use the first section image so the store top is never blank
      const firstImage = sections.find((s: any) => s.imageUrl)?.imageUrl ?? null;
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

      return createdSections;
    }, { timeout: 30000 });

    return NextResponse.json({ ok: true, sectionsCreated: results.length });
  } catch (err) {
    console.error("[ai-setup/apply] error:", err);
    return NextResponse.json({ error: "Failed to create store structure" }, { status: 500 });
  }
}
