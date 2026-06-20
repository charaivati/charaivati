// prisma/seed-prodsearch-ui.js
// PRODSEARCH-1b — seeds the 5 product-search UI strings for the /app/saved
// Products tab as Tab rows (category "ui-prodsearch"), plus TabTranslation rows
// for every enabled Language.
//
// Uses `pg` directly so it works even when the Prisma client was generated
// with --no-engine (dev server running on Windows, DLL locked).
//
// Run standalone:
//   node prisma/seed-prodsearch-ui.js
//   LIBRE_TRANSLATE_URL=https://libretranslate.com node prisma/seed-prodsearch-ui.js

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const LIBRE_URL = process.env.LIBRE_TRANSLATE_URL || null;
const LIBRE_KEY = process.env.LIBRE_TRANSLATE_KEY || null;

const STRINGS = [
  {
    slug: "app-search-stores-tab",
    title: "Stores",
    description: "Saved page — tab label to browse by store",
  },
  {
    slug: "app-search-products-tab",
    title: "Products",
    description: "Saved page — tab label to search for products",
  },
  {
    slug: "app-search-products-placeholder",
    title: "Search products…",
    description: "Saved page — placeholder in the product search input",
  },
  {
    slug: "app-search-products-no-results",
    title: "No products found. Try a different search.",
    description: "Saved page — empty state when product search returns no results",
  },
  {
    slug: "app-search-filter-by-category",
    title: "Filter by category",
    description: "Saved page — Products tab button to open the category filter modal (distinct from app-saved-filter-button, which is the Stores tab's address+category filter button)",
  },
  {
    slug: "app-search-products-heading",
    title: "Search for any product across all stores.",
    description: "Saved page — subtitle shown before the user types a product search",
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

function cuid() {
  // minimal cuid-style id for new Tab rows
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return "c" + ts + rand;
}

async function seedTabs(client) {
  let created = 0, updated = 0;
  for (const s of STRINGS) {
    const { rows } = await client.query(
      `SELECT id FROM "Tab" WHERE slug = $1 LIMIT 1`,
      [s.slug]
    );
    if (rows.length > 0) {
      await client.query(
        `UPDATE "Tab" SET title = $1, description = $2, category = $3 WHERE id = $4`,
        [s.title, s.description, "ui-prodsearch", rows[0].id]
      );
      updated++;
    } else {
      const id = cuid();
      await client.query(
        `INSERT INTO "Tab" (id, slug, title, description, category, is_default, is_custom, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, false, false, NOW(), NOW())`,
        [id, s.slug, s.title, s.description, "ui-prodsearch"]
      );
      created++;
    }
  }
  console.log(`Tab upserted: ${created} created, ${updated} updated`);
}

async function seedTranslations(client) {
  // Fetch tab IDs for our slugs
  const slugList = STRINGS.map((s) => s.slug);
  const { rows: tabs } = await client.query(
    `SELECT id, slug FROM "Tab" WHERE slug = ANY($1::text[])`,
    [slugList]
  );
  const tabBySlug = Object.fromEntries(tabs.map((t) => [t.slug, t.id]));

  // Fetch enabled languages
  const { rows: languages } = await client.query(
    `SELECT code FROM "Language" WHERE enabled = true`
  );
  console.log(`Found ${languages.length} enabled languages`);

  let count = 0;

  for (const s of STRINGS) {
    const tabId = tabBySlug[s.slug];
    if (!tabId) continue;

    for (const lang of languages) {
      if (!lang.code) continue;

      let title = s.title;
      if (lang.code !== "en" && LIBRE_URL) {
        const translated = await translateLibre(s.title, "en", lang.code);
        if (translated) title = translated;
      }

      try {
        const ttId = cuid();
        await client.query(
          `INSERT INTO "TabTranslation" (id, "tabId", locale, title, "updatedAt")
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT ("tabId", locale)
           DO UPDATE SET title = EXCLUDED.title, "updatedAt" = NOW()`,
          [ttId, tabId, lang.code, title]
        );
        count++;
      } catch (e) {
        console.warn(`  skip ${s.slug}/${lang.code}: ${e?.message ?? e}`);
      }
    }
  }
  console.log(`TabTranslation upserted: ${count} rows`);
}

async function main() {
  console.log("Seeding product-search UI strings...");
  const client = await pool.connect();
  try {
    await seedTabs(client);
    await seedTranslations(client);
  } finally {
    client.release();
    await pool.end();
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
