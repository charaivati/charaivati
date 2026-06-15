// prisma/seed-store-taxonomy-ui.js
// TAG-STORE-1c-fix §6 — seeds the 8 UI strings for the owner-side
// category/tag picker (Store tab) as Tab rows (category "ui-store"),
// plus TabTranslation rows for every enabled Language.
//
// Mirrors the fallback-copy pattern in prisma/seed-store-taxonomy.js:
// if LIBRE_TRANSLATE_URL is set, translate; otherwise copy the English
// string as the translation for every locale (including "en").
//
// Run standalone:
//   node prisma/seed-store-taxonomy-ui.js
//   LIBRE_TRANSLATE_URL=https://libretranslate.com node prisma/seed-store-taxonomy-ui.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const LIBRE_URL = process.env.LIBRE_TRANSLATE_URL || null;
const LIBRE_KEY = process.env.LIBRE_TRANSLATE_KEY || null;

const STRINGS = [
  { slug: "store-categories-label",  title: "Categories",        description: "Store tab — category picker section label" },
  { slug: "store-categories-prompt", title: "What do you sell?",  description: "Store tab — category picker prompt" },
  { slug: "store-tags-label",        title: "Tags",               description: "Store tab — tag picker section label" },
  { slug: "store-tags-prompt",       title: "How you operate",    description: "Store tab — tag picker prompt" },
  { slug: "store-taxonomy-save",     title: "Save",               description: "Store tab — category/tag picker save button" },
  { slug: "store-taxonomy-saving",   title: "Saving…",            description: "Store tab — category/tag picker save button, in-flight state" },
  { slug: "store-taxonomy-saved",    title: "Saved ✓",            description: "Store tab — category/tag picker save button, success state" },
  { slug: "store-categories-cap",    title: "Pick up to 3",       description: "Store tab — category picker cap hint, shown when 3 categories are selected" },
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
      await prisma.tab.update({ where: { id: existing.id }, data: { title: s.title, description: s.description, category: "ui-store" } });
      updated++;
    } else {
      await prisma.tab.create({ data: { slug: s.slug, title: s.title, description: s.description, category: "ui-store", is_default: false, is_custom: false } });
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
  console.log(`\n=== seed-store-taxonomy-ui${LIBRE_URL ? "" : " (no LIBRE_TRANSLATE_URL — English fallback)"} ===\n`);

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
