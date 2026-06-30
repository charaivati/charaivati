// prisma/seed-chakra-ui.js
// CHAKRA-1 §F — seeds the chakra landing UI strings as Tab rows (category
// "ui-chakra") + TabTranslation rows for every enabled Language. Mirrors the
// English-fallback pattern in prisma/seed-store-taxonomy-ui.js: translate via
// LibreTranslate when LIBRE_TRANSLATE_URL is set, otherwise copy English.
//
// Run standalone:  node prisma/seed-chakra-ui.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const LIBRE_URL = process.env.LIBRE_TRANSLATE_URL || null;
const LIBRE_KEY = process.env.LIBRE_TRANSLATE_KEY || null;

const STRINGS = [
  { slug: "chakra-title",    title: "Your inner spine",                  description: "Chakra landing — heading" },
  { slug: "chakra-sub",      title: "Where your energy is rising",        description: "Chakra landing — subheading" },
  { slug: "chakra-feel",     title: "How does this feel?",                description: "Chakra card — self-report slider label" },
  { slug: "chakra-platform", title: "Platform sees",                      description: "Chakra card — platform score prefix" },
  { slug: "chakra-you",      title: "you feel",                           description: "Chakra card — self-report score prefix" },
  { slug: "chakra-todos",    title: "To-dos",                             description: "Chakra card — tagged todos heading" },
  { slug: "chakra-awaken",   title: "Nothing here yet — ready to awaken.", description: "Chakra card — empty/dormant todos" },
  { slug: "chakra-open",     title: "Open",                               description: "Chakra card — deep-link button" },
  { slug: "chakra-coming",   title: "Coming soon",                        description: "Chakra card — disabled crown deep-link" },
  { slug: "chakra-saved",    title: "Saved ✓",                            description: "Chakra card — self-report saved confirmation" },
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
  console.log(`\n=== seed-chakra-ui${LIBRE_URL ? "" : " (no LIBRE_TRANSLATE_URL — English fallback)"} ===\n`);
  const languages = await prisma.language.findMany({ where: { enabled: true }, orderBy: { id: "asc" } });
  console.log(`Languages found: ${languages.length}`);
  await seedTabs();
  const translations = await seedTranslations(languages);
  console.log(`\n=== Done === Strings: ${STRINGS.length}, Languages: ${languages.length}, rows: ${translations}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
