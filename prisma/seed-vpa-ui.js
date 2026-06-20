// prisma/seed-vpa-ui.js
// REQBCAST-1b — seeds the 8 UPI-VPA UI strings as Tab rows (category "ui-vpa")
// plus TabTranslation rows for every enabled Language. Mirrors seed-prodsearch-ui.js.
//
// Run standalone:
//   node prisma/seed-vpa-ui.js
//   LIBRE_TRANSLATE_URL=https://libretranslate.com node prisma/seed-vpa-ui.js

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
  { slug: "pay-vpa-label", title: "UPI ID", description: "VPA setter — field label" },
  { slug: "pay-vpa-placeholder", title: "yourname@bank", description: "VPA setter — input placeholder" },
  {
    slug: "pay-vpa-help",
    title: "Buyers pay you directly at this UPI ID. Charaivati never handles the money.",
    description: "VPA setter — help text (display/handoff-only doctrine)",
  },
  { slug: "pay-vpa-invalid", title: "Enter a valid UPI ID like name@bank.", description: "VPA setter — invalid-format error" },
  { slug: "pay-vpa-save", title: "Save UPI ID", description: "VPA setter — save button" },
  { slug: "pay-vpa-saved", title: "Saved ✓", description: "VPA setter — saved confirmation" },
  { slug: "pay-to-vpa-label", title: "Pay directly to", description: "PayToVpa — handoff label shown to a paying party" },
  { slug: "pay-vpa-copy", title: "Copy", description: "PayToVpa — copy-to-clipboard button" },
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
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return "c" + ts + rand;
}

async function seedTabs(client) {
  let created = 0, updated = 0;
  for (const s of STRINGS) {
    const { rows } = await client.query(`SELECT id FROM "Tab" WHERE slug = $1 LIMIT 1`, [s.slug]);
    if (rows.length > 0) {
      await client.query(
        `UPDATE "Tab" SET title = $1, description = $2, category = $3 WHERE id = $4`,
        [s.title, s.description, "ui-vpa", rows[0].id]
      );
      updated++;
    } else {
      const id = cuid();
      await client.query(
        `INSERT INTO "Tab" (id, slug, title, description, category, is_default, is_custom, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, false, false, NOW(), NOW())`,
        [id, s.slug, s.title, s.description, "ui-vpa"]
      );
      created++;
    }
  }
  console.log(`Tab upserted: ${created} created, ${updated} updated`);
}

async function seedTranslations(client) {
  const slugList = STRINGS.map((s) => s.slug);
  const { rows: tabs } = await client.query(
    `SELECT id, slug FROM "Tab" WHERE slug = ANY($1::text[])`,
    [slugList]
  );
  const tabBySlug = Object.fromEntries(tabs.map((t) => [t.slug, t.id]));

  const { rows: languages } = await client.query(`SELECT code FROM "Language" WHERE enabled = true`);
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
  console.log("Seeding UPI-VPA UI strings...");
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
