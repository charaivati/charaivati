// prisma/seed-store-taxonomy.js
// TAG-STORE-1b — seeds the controlled vocabulary for store discovery
// (StoreCategory / StoreTag) plus translations for every enabled Language,
// and links the "Breakfast by Arun" sample store (if it exists) to a few
// categories/tags for testing.
//
// Run standalone (NOT chained into seed.js):
//   node prisma/seed-store-taxonomy.js
//   LIBRE_TRANSLATE_URL=https://libretranslate.com node prisma/seed-store-taxonomy.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const LIBRE_URL = process.env.LIBRE_TRANSLATE_URL || null;
const LIBRE_KEY = process.env.LIBRE_TRANSLATE_KEY || null;

const CATEGORIES = [
  { slug: "grocery", title: "Grocery & Kirana", description: "Daily essentials, packaged goods, staples" },
  { slug: "food", title: "Food & Restaurant", description: "Cooked meals, snacks, tiffin, eateries" },
  { slug: "vegetables", title: "Vegetables & Fruits", description: "Fresh produce" },
  { slug: "dairy", title: "Dairy & Bakery", description: "Milk, curd, bread, cakes" },
  { slug: "meat", title: "Meat & Fish", description: "Poultry, mutton, seafood" },
  { slug: "pharmacy", title: "Pharmacy & Health", description: "Medicines, wellness, health supplies" },
  { slug: "clothing", title: "Clothing & Apparel", description: "Garments, fabric, fashion" },
  { slug: "tailor", title: "Tailoring & Stitching", description: "Custom stitching, alterations" },
  { slug: "electronics", title: "Electronics & Mobile", description: "Devices, accessories, repair" },
  { slug: "hardware", title: "Hardware & Building", description: "Tools, paint, construction supplies" },
  { slug: "stationery", title: "Stationery & Books", description: "Books, school/office supplies" },
  { slug: "salon", title: "Salon & Beauty", description: "Haircut, grooming, beauty services" },
  { slug: "home_services", title: "Home Services", description: "Repair, cleaning, maintenance" },
  { slug: "handmade", title: "Handmade & Crafts", description: "Artisan goods, local crafts" },
  { slug: "services", title: "Other Services", description: "General services not listed above" },
];

const TAGS = [
  { slug: "home-delivery", title: "Home delivery" },
  { slug: "pickup-available", title: "Pickup available" },
  { slug: "upi-accepted", title: "UPI accepted" },
  { slug: "cash-only", title: "Cash only" },
  { slug: "open-late", title: "Open late" },
  { slug: "open-24x7", title: "Open 24x7" },
  { slug: "veg-only", title: "Veg only" },
  { slug: "non-veg", title: "Non-veg" },
  { slug: "women-led", title: "Women-led" },
  { slug: "made-to-order", title: "Made to order" },
  { slug: "wholesale", title: "Wholesale" },
  { slug: "organic", title: "Organic" },
  { slug: "second-hand", title: "Second-hand" },
  { slug: "repair-service", title: "Repair service" },
  { slug: "bulk-discount", title: "Bulk discount" },
];

// Sample store backfill (TAG-STORE-1b §5)
const SAMPLE_STORE_NAME = "Breakfast by Arun";
const SAMPLE_CATEGORY_SLUGS = ["food"];
const SAMPLE_TAG_SLUGS = ["home-delivery", "upi-accepted", "veg-only", "made-to-order"];

async function translateLibre(text, source, target) {
  if (!LIBRE_URL) return null;
  try {
    const body = { q: text, source, target, format: "text" };
    if (LIBRE_KEY) body.api_key = LIBRE_KEY;
    const res = await fetch(`${LIBRE_URL}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json && json.translatedText) return json.translatedText;
    if (json && json.result) return json.result;
    return null;
  } catch (e) {
    console.warn("Libre translate failed:", e?.message ?? e);
    return null;
  }
}

async function seedCategories() {
  let count = 0;
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i];
    await prisma.storeCategory.upsert({
      where: { slug: c.slug },
      update: { order: i },
      create: { slug: c.slug, order: i },
    });
    count++;
  }
  console.log(`StoreCategory upserted: ${count}`);
  return count;
}

async function seedTags() {
  let count = 0;
  for (let i = 0; i < TAGS.length; i++) {
    const t = TAGS[i];
    await prisma.storeTag.upsert({
      where: { slug: t.slug },
      update: { order: i },
      create: { slug: t.slug, order: i },
    });
    count++;
  }
  console.log(`StoreTag upserted: ${count}`);
  return count;
}

async function seedCategoryTranslations(languages) {
  const categories = await prisma.storeCategory.findMany();
  const bySlug = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c]));
  let count = 0;

  for (const cat of categories) {
    const src = bySlug[cat.slug];
    if (!src) continue;

    for (const lang of languages) {
      if (!lang.code) continue;

      let title = src.title;
      let description = src.description ?? null;

      if (lang.code !== "en") {
        if (LIBRE_URL) {
          const translatedTitle = await translateLibre(src.title, "en", lang.code);
          if (translatedTitle) title = translatedTitle;
          if (src.description) {
            const translatedDesc = await translateLibre(src.description, "en", lang.code);
            if (translatedDesc) description = translatedDesc;
          }
        }
      }

      await prisma.storeCategoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: cat.id, locale: lang.code } },
        update: { title, description },
        create: { categoryId: cat.id, locale: lang.code, title, description },
      });
      count++;
    }
  }

  console.log(`StoreCategoryTranslation upserted: ${count}`);
  return count;
}

async function seedTagTranslations(languages) {
  const tags = await prisma.storeTag.findMany();
  const bySlug = Object.fromEntries(TAGS.map((t) => [t.slug, t]));
  let count = 0;

  for (const tag of tags) {
    const src = bySlug[tag.slug];
    if (!src) continue;

    for (const lang of languages) {
      if (!lang.code) continue;

      let title = src.title;

      if (lang.code !== "en" && LIBRE_URL) {
        const translatedTitle = await translateLibre(src.title, "en", lang.code);
        if (translatedTitle) title = translatedTitle;
      }

      await prisma.storeTagTranslation.upsert({
        where: { tagId_locale: { tagId: tag.id, locale: lang.code } },
        update: { title },
        create: { tagId: tag.id, locale: lang.code, title },
      });
      count++;
    }
  }

  console.log(`StoreTagTranslation upserted: ${count}`);
  return count;
}

async function backfillSampleStore() {
  const store = await prisma.store.findFirst({ where: { name: SAMPLE_STORE_NAME } });
  if (!store) {
    console.log(`Backfill skipped: no store named "${SAMPLE_STORE_NAME}" found.`);
    return { linked: false };
  }

  const categories = await prisma.storeCategory.findMany({ where: { slug: { in: SAMPLE_CATEGORY_SLUGS } } });
  const tags = await prisma.storeTag.findMany({ where: { slug: { in: SAMPLE_TAG_SLUGS } } });

  let categoryLinks = 0;
  for (const cat of categories) {
    await prisma.storeCategoryLink.upsert({
      where: { storeId_categoryId: { storeId: store.id, categoryId: cat.id } },
      update: {},
      create: { storeId: store.id, categoryId: cat.id },
    });
    categoryLinks++;
  }

  let tagLinks = 0;
  for (const tag of tags) {
    await prisma.storeTagLink.upsert({
      where: { storeId_tagId: { storeId: store.id, tagId: tag.id } },
      update: {},
      create: { storeId: store.id, tagId: tag.id },
    });
    tagLinks++;
  }

  console.log(`Backfill: linked "${SAMPLE_STORE_NAME}" (${store.id}) to ${categoryLinks} category(ies) and ${tagLinks} tag(s).`);
  return { linked: true, categoryLinks, tagLinks };
}

async function main() {
  console.log(`\n=== seed-store-taxonomy${LIBRE_URL ? "" : " (no LIBRE_TRANSLATE_URL — English fallback)"} ===\n`);

  const languages = await prisma.language.findMany({ where: { enabled: true }, orderBy: { id: "asc" } });
  console.log(`Languages found: ${languages.length}`);

  const categoryCount = await seedCategories();
  const tagCount = await seedTags();
  const categoryTranslations = await seedCategoryTranslations(languages);
  const tagTranslations = await seedTagTranslations(languages);
  const backfill = await backfillSampleStore();

  console.log("\n=== Done ===");
  console.log(`Categories: ${categoryCount}, Tags: ${tagCount}`);
  console.log(`Category translations: ${categoryTranslations}, Tag translations: ${tagTranslations}`);
  console.log(`Backfill: ${JSON.stringify(backfill)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
