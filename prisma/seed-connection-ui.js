// prisma/seed-connection-ui.js
// CHAKRA-ACTION-2 — seeds the /chakra/sacral/connection page UI strings as Tab
// rows (category "ui-chakra", same bucket as the other chakra strings) +
// TabTranslation rows for every enabled Language. Mirrors the English-fallback
// pattern in prisma/seed-survival-ui.js: translate via LibreTranslate when
// LIBRE_TRANSLATE_URL is set, otherwise copy English.
//
// Run standalone:  node prisma/seed-connection-ui.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const LIBRE_URL = process.env.LIBRE_TRANSLATE_URL || null;
const LIBRE_KEY = process.env.LIBRE_TRANSLATE_KEY || null;

const STRINGS = [
  { slug: "connection-title",             title: "Connection plan",           description: "Connection page — heading" },
  { slug: "connection-sub",               title: "What you create, who you keep close, and the circles that hold you.", description: "Connection page — subheading" },
  { slug: "connection-hobbies-title",     title: "Hobbies & creativity",       description: "Connection page — hobbies section heading" },
  { slug: "connection-hobbies-sub",       title: "What lets your creative flow move.", description: "Connection page — hobbies subheading" },
  { slug: "connection-hobbies-frequency", title: "How often",                  description: "Connection page — hobby frequency label" },
  { slug: "connection-hobbies-empty",     title: "Pick a few to start — you can change these anytime.", description: "Connection page — empty hobbies hint" },
  { slug: "connection-friends-title",     title: "Friends",                    description: "Connection page — friends section heading" },
  { slug: "connection-friends-sub",       title: "The people you've connected with here.", description: "Connection page — friends subheading" },
  { slug: "connection-circles-title",     title: "Circles",                    description: "Connection page — circles section heading" },
  { slug: "connection-circles-sub",       title: "Group your friends and connections however makes sense to you.", description: "Connection page — circles subheading" },
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
    return json?.translatedText || json?.result || null;
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
      await prisma.tab.update({ where: { id: existing.id }, data: { title: s.title, description: s.description, category: "ui-chakra" } });
      updated++;
    } else {
      await prisma.tab.create({ data: { slug: s.slug, title: s.title, description: s.description, category: "ui-chakra", is_default: false, is_custom: false } });
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
        const tr = await translateLibre(src.title, "en", lang.code);
        if (tr) title = tr;
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
  console.log(`\n=== seed-connection-ui${LIBRE_URL ? "" : " (no LIBRE_TRANSLATE_URL — English fallback)"} ===\n`);
  const languages = await prisma.language.findMany({ where: { enabled: true }, orderBy: { id: "asc" } });
  console.log(`Languages found: ${languages.length}`);
  await seedTabs();
  const translations = await seedTranslations(languages);
  console.log(`\n=== Done === Strings: ${STRINGS.length}, Languages: ${languages.length}, rows: ${translations}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
