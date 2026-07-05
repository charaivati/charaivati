// prisma/seed-survival-ui.js
// SURVIVAL-1 — seeds the /chakra/root/survival page UI strings as Tab rows
// (category "ui-chakra", same bucket as the other chakra strings) +
// TabTranslation rows for every enabled Language. Mirrors the English-fallback
// pattern in prisma/seed-chakra-ui.js: translate via LibreTranslate when
// LIBRE_TRANSLATE_URL is set, otherwise copy English.
//
// Run standalone:  node prisma/seed-survival-ui.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const LIBRE_URL = process.env.LIBRE_TRANSLATE_URL || null;
const LIBRE_KEY = process.env.LIBRE_TRANSLATE_KEY || null;

const STRINGS = [
  { slug: "survival-title",            title: "Survival plan",                                                                     description: "Survival page — heading" },
  { slug: "survival-sub",              title: "Food, the funds to get it, and the people around you — the ground everything else stands on.", description: "Survival page — subheading" },
  { slug: "survival-food-title",       title: "Your food requirement",     description: "Survival page — food section heading" },
  { slug: "survival-food-edit",        title: "Edit details",              description: "Survival page — opens EditHealthModal" },
  { slug: "survival-food-estimated",   title: "Estimated — add height, weight and age for a closer number.", description: "Survival page — estimate note" },
  { slug: "survival-food-kcal",        title: "kcal / day",                description: "Survival page — calories unit" },
  { slug: "survival-food-protein",     title: "Protein",                   description: "Survival page — protein label" },
  { slug: "survival-food-cereals",     title: "Cereals (rice / atta)",     description: "Survival page — food row" },
  { slug: "survival-food-pulses",      title: "Pulses / dal",              description: "Survival page — food row" },
  { slug: "survival-food-oils",        title: "Oils & fats",               description: "Survival page — food row" },
  { slug: "survival-food-veg",         title: "Vegetables & fruit",        description: "Survival page — food row" },
  { slug: "survival-food-water",       title: "Water",                     description: "Survival page — food row" },
  { slug: "survival-food-perday",      title: "per day",                   description: "Survival page — table column" },
  { slug: "survival-food-permonth",    title: "per month",                 description: "Survival page — table column" },
  { slug: "survival-food-pref",        title: "Preference",                description: "Survival page — food preference label" },
  { slug: "survival-food-athome",      title: "Available at home",         description: "Survival page — available foods label" },
  { slug: "survival-food-empty",       title: "Tell us what's available at home — it shapes the plan.", description: "Survival page — empty foods hint" },
  { slug: "survival-funds-title",      title: "Funds for survival",        description: "Survival page — funds section heading" },
  { slug: "survival-funds-sub",        title: "Just the essentials — food, housing, health. The rest of your money lives in other chakras.", description: "Survival page — funds subheading" },
  { slug: "survival-funds-total",      title: "Survival / mo",             description: "Survival page — metric" },
  { slug: "survival-funds-food",       title: "Food / mo",                 description: "Survival page — metric" },
  { slug: "survival-funds-income",     title: "Income / mo",               description: "Survival page — metric" },
  { slug: "survival-funds-gap",        title: "Survival costs exceed income — the Action factor (earning) is where this ground firms up.", description: "Survival page — shortfall note" },
  { slug: "survival-community-title",  title: "People to survive with",    description: "Survival page — community section heading" },
  { slug: "survival-community-sub",    title: "Food alone doesn't keep you standing — a family or community does. Join one, or start your own.", description: "Survival page — community subheading" },
  { slug: "survival-community-search", title: "Search communities…",       description: "Survival page — search placeholder" },
  { slug: "survival-community-join",   title: "Join",                      description: "Survival page — join button" },
  { slug: "survival-community-requested", title: "Requested",              description: "Survival page — pending membership badge" },
  { slug: "survival-community-member", title: "Member ✓",                  description: "Survival page — approved membership badge" },
  { slug: "survival-community-view",   title: "View community",            description: "Survival page — link to /community/[id]" },
  { slug: "survival-community-none",   title: "No communities found yet.", description: "Survival page — empty search result" },
  { slug: "survival-community-members", title: "members",                  description: "Survival page — member count suffix" },
  { slug: "survival-community-create", title: "Start a family group",      description: "Survival page — create heading" },
  { slug: "survival-community-create-sub", title: "A community initiative for your household — plan food and essentials together.", description: "Survival page — create subheading" },
  { slug: "survival-community-create-ph",  title: "e.g. Sharma family",    description: "Survival page — create input placeholder" },
  { slug: "survival-community-create-btn", title: "Create",                description: "Survival page — create button" },
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
  console.log(`\n=== seed-survival-ui${LIBRE_URL ? "" : " (no LIBRE_TRANSLATE_URL — English fallback)"} ===\n`);
  const languages = await prisma.language.findMany({ where: { enabled: true }, orderBy: { id: "asc" } });
  console.log(`Languages found: ${languages.length}`);
  await seedTabs();
  const translations = await seedTranslations(languages);
  console.log(`\n=== Done === Strings: ${STRINGS.length}, Languages: ${languages.length}, rows: ${translations}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
