// prisma/seed-discover-ui.js
// DISCOVER-1b — seeds the UI strings for the customer-facing store
// discovery page (/app/discover) as Tab rows (category "ui-discover"),
// plus TabTranslation rows for every enabled Language.
//
// Mirrors prisma/seed-store-taxonomy-ui.js: if LIBRE_TRANSLATE_URL is
// set, translate; otherwise copy the English string as the translation
// for every locale (including "en").
//
// Existing categoriesLabel/tagsLabel strings (store-categories-label,
// store-tags-label, from TAG-STORE-1c) are reused directly — not
// duplicated here.
//
// Run standalone:
//   node prisma/seed-discover-ui.js
//   LIBRE_TRANSLATE_URL=https://libretranslate.com node prisma/seed-discover-ui.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const LIBRE_URL = process.env.LIBRE_TRANSLATE_URL || null;
const LIBRE_KEY = process.env.LIBRE_TRANSLATE_KEY || null;

const STRINGS = [
  { slug: "app-discover-map-view",          title: "Map",                                          description: "Discover page — map view toggle" },
  { slug: "app-discover-list-view",         title: "List",                                         description: "Discover page — list view toggle" },
  { slug: "app-discover-near-heading",      title: "Stores near",                                  description: "Discover page — address selector label" },
  { slug: "app-discover-select-address",    title: "Select address",                               description: "Discover page — address selector placeholder" },
  { slug: "app-discover-add-address",       title: "Add new address",                              description: "Discover page — address selector add-new option" },
  { slug: "app-discover-distance-km",       title: "{km} km away",                                 description: "Discover page — store distance label" },
  { slug: "app-discover-distance-unknown",  title: "Distance unknown",                             description: "Discover page — shown when a store has no location" },
  { slug: "app-discover-no-stores-found",   title: "No stores match these filters",                description: "Discover page — empty list state" },
  { slug: "app-discover-map-missing-count", title: "{n} stores aren't shown on the map",           description: "Discover page — count of stores without coordinates" },
  { slug: "app-discover-gate-title",        title: "Add an address to discover stores near you",   description: "Discover page — no-address gate heading" },
  { slug: "app-discover-gate-button",       title: "Add address",                                  description: "Discover page — no-address gate button" },
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
  let created = 0, updated = 0;
  for (const s of STRINGS) {
    const existing = await prisma.tab.findUnique({ where: { slug: s.slug } });
    if (existing) {
      await prisma.tab.update({ where: { id: existing.id }, data: { title: s.title, description: s.description, category: "ui-discover" } });
      updated++;
    } else {
      await prisma.tab.create({ data: { slug: s.slug, title: s.title, description: s.description, category: "ui-discover", is_default: false, is_custom: false } });
      created++;
    }
  }
  console.log(`Tab upserted: ${created} created, ${updated} updated`);
}

async function seedTranslations(languages) {
  const tabs = await prisma.tab.findMany({ where: { slug: { in: STRINGS.map((s) => s.slug) } } });
  const bySlug = Object.fromEntries(STRINGS.map((s) => [s.slug, s]));
  let count = 0;

  for (const tab of tabs) {
    const src = bySlug[tab.slug];
    if (!src) continue;

    for (const lang of languages) {
      if (!lang.code) continue;

      let title = src.title;

      if (lang.code !== "en" && LIBRE_URL) {
        const translatedTitle = await translateLibre(src.title, "en", lang.code);
        if (translatedTitle) title = translatedTitle;
      }

      await prisma.tabTranslation.upsert({
        where: { tabId_locale: { tabId: tab.id, locale: lang.code } },
        update: { title, status: "published" },
        create: { tabId: tab.id, locale: lang.code, title, status: "published" },
      });
      count++;
    }
  }

  console.log(`TabTranslation upserted: ${count}`);
  return count;
}

async function main() {
  console.log(`\n=== seed-discover-ui${LIBRE_URL ? "" : " (no LIBRE_TRANSLATE_URL — English fallback)"} ===\n`);

  const languages = await prisma.language.findMany({ where: { enabled: true }, orderBy: { id: "asc" } });
  console.log(`Languages found: ${languages.length}`);

  await seedTabs();
  const translations = await seedTranslations(languages);

  console.log("\n=== Done ===");
  console.log(`Strings: ${STRINGS.length}, Languages: ${languages.length}, TabTranslation rows: ${translations}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
