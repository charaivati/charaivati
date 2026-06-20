import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { isValidVpa, normalizeVpa } from "@/lib/payments/vpa";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Resolve slug → real cuid if needed. A cuid is 25 chars starting with 'c',
  // all alphanumeric. Anything else is treated as a potential slug.
  const isCuid = /^c[a-z0-9]{24}$/i.test(id);
  let storeId = id;
  if (!isCuid) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Store" WHERE slug = ${id} AND "deletedAt" IS NULL LIMIT 1
    `;
    if (!rows[0]?.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    storeId = rows[0].id;
  }

  const [store, user] = await Promise.all([
    prisma.store.findUnique({
      where: { id: storeId },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            subsections: {
              orderBy: { order: "asc" },
              include: { blocks: { orderBy: { order: "asc" } } },
            },
            blocks: { where: { subsectionId: null }, orderBy: { order: "asc" } },
            filterLinks: { select: { filterId: true } },
            tiles: { orderBy: { order: "asc" } },
          },
        },
        filters: {
          orderBy: { order: "asc" },
          include: { banner: true, sections: { select: { sectionId: true } } },
        },
        banners: { where: { isGlobal: true }, take: 1 },
        owner: { select: { name: true } },
        categories: { select: { categoryId: true } },
        tags: { select: { tagId: true } },
      },
    }),
    getServerUser(req),
  ]);

  if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // A deleted store is invisible to everyone except the owner (greyed view via /store/account → Restore).
  if (store.deletedAt && store.ownerId !== user?.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch new fields via raw SQL — safe with stale Prisma client
  const extraRow = await prisma.$queryRaw<{
    slug: string | null;
    acceptingOrders: boolean;
    hoursText: string | null;
    upiVpa: string | null;
    line1: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    lat: number | null;
    lng: number | null;
  }[]>`
    SELECT slug, "acceptingOrders", "hoursText", "upiVpa", "line1", "city", "state", "pincode", "lat", "lng" FROM "Store" WHERE id = ${storeId} LIMIT 1
  `;
  const slug = extraRow[0]?.slug ?? null;
  const acceptingOrders = extraRow[0]?.acceptingOrders ?? false;
  const hoursText = extraRow[0]?.hoursText ?? null;
  const upiVpa = extraRow[0]?.upiVpa ?? null;
  const location = {
    line1: extraRow[0]?.line1 ?? null,
    city: extraRow[0]?.city ?? null,
    state: extraRow[0]?.state ?? null,
    pincode: extraRow[0]?.pincode ?? null,
    lat: extraRow[0]?.lat ?? null,
    lng: extraRow[0]?.lng ?? null,
  };

  let pageType = "store";
  if (store.pageId) {
    const page = await prisma.page.findUnique({
      where: { id: store.pageId },
      select: { pageType: true },
    });
    pageType = page?.pageType ?? "store";
  }

  const filters = (store.filters ?? []).map((f) => ({
    ...f,
    sectionIds: f.sections.map((s) => s.sectionId),
  }));

  const globalBanner = store.banners?.[0] ?? null;

  const sections = (store.sections ?? []).map((s) => ({
    ...s,
    filterIds: s.filterLinks.map((fl) => fl.filterId),
  }));

  // Reassign rowIndex for legacy sections: if all sections
  // have rowIndex=0, treat each as its own row based on order
  const allRowZero = sections.every((s) => (s.rowIndex ?? 0) === 0);

  const processedSections =
    allRowZero && sections.length > 1
      ? sections.map((s, i) => ({ ...s, rowIndex: i }))
      : sections;

  return NextResponse.json({
    ...store,
    slug,
    acceptingOrders,
    hoursText,
    upiVpa,
    location,
    sections: processedSections,
    filters,
    globalBanner,
    pageType,
    isOwner: user?.id === store.ownerId,
    ownerName: store.owner?.name ?? null,
    categoryIds: store.categories.map((c) => c.categoryId),
    tagIds: store.tags.map((t) => t.tagId),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = await prisma.store.findUnique({ where: { id }, select: { ownerId: true, deletedAt: true } });
  if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (store.ownerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // Reject edits to a deleted store — owner must restore it first.
  if (store.deletedAt) return NextResponse.json({ error: "This store has been deleted. Restore it before making changes." }, { status: 409 });

  const body = await req.json();
  const { name, description, deliveryFee, freeDeliveryAbove, acceptingOrders, hoursText, upiVpa, location, categoryIds, tagIds } = body;

  if (Array.isArray(categoryIds) && categoryIds.length > 3) {
    return NextResponse.json({ error: "Pick up to 3 categories" }, { status: 400 });
  }

  // UPI VPA (REQBCAST-1b) — shape-validated only, never resolution-checked.
  let upiVpaUpdate: string | null | undefined;
  if ("upiVpa" in body) {
    upiVpaUpdate = normalizeVpa(upiVpa);
    if (upiVpaUpdate && !isValidVpa(upiVpaUpdate)) {
      return NextResponse.json({ error: "Enter a valid UPI ID like name@bank." }, { status: 400 });
    }
  }

  const data: Record<string, unknown> = {};
  if (name?.trim()) data.name = name.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if ("deliveryFee" in body) data.deliveryFee = deliveryFee != null ? Number(deliveryFee) : null;
  if ("freeDeliveryAbove" in body) data.freeDeliveryAbove = freeDeliveryAbove != null ? Number(freeDeliveryAbove) : null;
  if ("acceptingOrders" in body) data.acceptingOrders = Boolean(acceptingOrders);
  if ("hoursText" in body) data.hoursText = typeof hoursText === "string" ? hoursText.trim() || null : null;

  const updated = await prisma.store.update({
    where: { id },
    data: data as any,
    select: { id: true, name: true, description: true, slug: true, deliveryFee: true, freeDeliveryAbove: true } as any,
  });

  // Store location (GEO-STORE-1) — written via raw SQL since the fields
  // were added after the last successful `prisma generate`.
  if (location && typeof location === "object") {
    const line1 = typeof location.line1 === "string" ? location.line1.trim() || null : null;
    const city = typeof location.city === "string" ? location.city.trim() || null : null;
    const state = typeof location.state === "string" ? location.state.trim() || null : null;
    const pincode = typeof location.pincode === "string" ? location.pincode.trim() || null : null;
    const lat = typeof location.lat === "number" ? location.lat : null;
    const lng = typeof location.lng === "number" ? location.lng : null;
    await prisma.$executeRaw`
      UPDATE "Store"
      SET "line1" = ${line1}, "city" = ${city}, "state" = ${state}, "pincode" = ${pincode}, "lat" = ${lat}, "lng" = ${lng}
      WHERE id = ${id}
    `;
  }

  // UPI VPA write (REQBCAST-1b) — raw SQL, stale-client pattern.
  if (upiVpaUpdate !== undefined) {
    await prisma.$executeRaw`UPDATE "Store" SET "upiVpa" = ${upiVpaUpdate} WHERE id = ${id}`;
  }

  // Store category/tag links (TAG-STORE-1c) — empty array clears, omitted key
  // leaves the table untouched. Category count is capped at 3 (checked above).
  if (Array.isArray(categoryIds)) {
    await prisma.$transaction([
      prisma.storeCategoryLink.deleteMany({ where: { storeId: id } }),
      prisma.storeCategoryLink.createMany({
        data: categoryIds.map((categoryId: string) => ({ storeId: id, categoryId })),
        skipDuplicates: true,
      }),
    ]);
  }
  if (Array.isArray(tagIds)) {
    await prisma.$transaction([
      prisma.storeTagLink.deleteMany({ where: { storeId: id } }),
      prisma.storeTagLink.createMany({
        data: tagIds.map((tagId: string) => ({ storeId: id, tagId })),
        skipDuplicates: true,
      }),
    ]);
  }

  const extraRow = await prisma.$queryRaw<{
    acceptingOrders: boolean;
    hoursText: string | null;
    upiVpa: string | null;
    line1: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    lat: number | null;
    lng: number | null;
  }[]>`
    SELECT "acceptingOrders", "hoursText", "upiVpa", "line1", "city", "state", "pincode", "lat", "lng" FROM "Store" WHERE id = ${id} LIMIT 1
  `;

  return NextResponse.json({
    ...updated,
    acceptingOrders: extraRow[0]?.acceptingOrders ?? false,
    hoursText: extraRow[0]?.hoursText ?? null,
    upiVpa: extraRow[0]?.upiVpa ?? null,
    location: {
      line1: extraRow[0]?.line1 ?? null,
      city: extraRow[0]?.city ?? null,
      state: extraRow[0]?.state ?? null,
      pincode: extraRow[0]?.pincode ?? null,
      lat: extraRow[0]?.lat ?? null,
      lng: extraRow[0]?.lng ?? null,
    },
  });
}
