// prisma/seed-saved-filters-ui.js
// DISCOVER-INLINE-1b — seeds the 5 UI strings for the /app/saved filter modal
// as Tab rows (category "ui-saved-filters"), plus TabTranslation rows for every
// enabled Language.
//
// Mirrors the fallback-copy pattern in prisma/seed-store-taxonomy-ui.js:
// if LIBRE_TRANSLATE_URL is set, translate; otherwise copy the English
// string as the translation for every locale (including "en").
//
// Run standalone:
//   node prisma/seed-saved-filters-ui.js
//   LIBRE_TRANSLATE_URL=https://libretranslate.com node prisma/seed-saved-filters-ui.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const LIBRE_URL = process.env.LIBRE_TRANSLATE_URL || null;
const LIBRE_KEY = process.env.LIBRE_TRANSLATE_KEY || null;

const STRINGS = [
  {
    slug: "app-saved-filter-button",
    title: "Filter stores",
    description: "Saved page — button to open the discovery filter modal",
  },
  {
    slug: "app-saved-filter-active",
    title: "{n} filters active",
    description: "Saved page — filter button label when filters are applied; {n} is the count",
  },
  {
    slug: "app-saved-apply-filters",
    title: "Apply",
    description: "Discovery filter modal — apply button in sticky footer",
  },
  {
    slug: "app-saved-clear-filters",
    title: "Clear",
    description: "Discovery filter modal — clear button in sticky footer",
  },
  {
    slug: "app-saved-filter-modal-title",
    title: "Find stores near you",
    description: "Discovery filter modal — header title",
  },
];

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

async function seedTabs() {
  let created = 0,
    updated = 0;
  for (const s of STRINGS) {
    const existing = await prisma.tab.findUnique({ where: { slug: s.slug } });
    if (existing) {
      await prisma.tab.update({
        where: { id: existing.id },
        data: { title: s.title, description: s.description, category: "ui-saved-filters" },
      });
      updated++;
    } else {
      await prisma.tab.create({
        data: {
          slug: s.slug,
          title: s.title,
          description: s.description,
          category: "ui-saved-filters",
          is_default: false,
          is_custom: false,
        },
      });
      created++;
    }
  }
  console.log(`Tab upserted: ${created} created, ${updated} updated`);
}

async function seedTranslations(languages) {
  const tabs = await prisma.tab.findMany({
    where: { slug: { in: STRINGS.map((s) => s.slug) } },
  });
  const bySlug = Object.fromEntries(STRINGS.map((s) => [s.slug, s]));
  let count = 0;

  for (const tab of tabs) {
    const src = bySlug[tab.slug];
    if (!src) continue;

    for (const lang of languages) {
      if (!lang.code) continue;

      let title = src.title;

      if (lang.code !== "en" && LIBRE_URL) {
        const translated = await translateLibre(src.title, "en", lang.code);
        if (translated) title = translated;
      }

      try {
        await prisma.tabTranslation.upsert({
          where: { tabId_locale: { tabId: tab.id, locale: lang.code } },
          update: { title },
          create: { tabId: tab.id, locale: lang.code, title },
        });
        count++;
      } catch (e) {
        console.warn(`  skip ${tab.slug}/${lang.code}: ${e?.message ?? e}`);
      }
    }
  }
  console.log(`TabTranslation upserted: ${count} rows`);
}

async function main() {
  console.log("Seeding saved-filters UI strings...");

  await seedTabs();

  const languages = await prisma.language.findMany({ where: { enabled: true } });
  console.log(`Found ${languages.length} enabled languages`);

  await seedTranslations(languages);

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
