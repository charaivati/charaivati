// prisma/seed-upi-pay-ui.js
// UPI-INTENT-1b — seeds the UPI intent-button UI string as a Tab row
// (category "ui-upi-pay") plus TabTranslation rows for all 16 enabled languages.
// Mirrors seed-vpa-ui.js pattern.
//
// Run standalone:
//   node prisma/seed-upi-pay-ui.js
//   LIBRE_TRANSLATE_URL=https://libretranslate.com node prisma/seed-upi-pay-ui.js

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const LIBRE_URL = process.env.LIBRE_TRANSLATE_URL || null;
const LIBRE_KEY = process.env.LIBRE_TRANSLATE_KEY || null;

// Template label; ₹{amount} is composed in JSX so only the static prefix is seeded.
const STRINGS = [
  { slug: "pay-via-upi-btn", title: "Pay via UPI", description: "UPI intent button — shown above the copy-VPA row when amount is known" },
  { slug: "pay-qr-scan", title: "Scan to pay", description: "Caption under the desktop QR code in PayToVpa — UPI-QR-1" },
  // UPI-QRUPLOAD-1b — QR upload / decode UI strings in VpaSettingCard
  { slug: "pay-qr-upload-btn", title: "Upload payment QR", description: "VpaSettingCard — button to upload a shopkeeper QR image for VPA pre-fill" },
  { slug: "pay-qr-prefill-hint", title: "VPA filled from QR — review and save.", description: "VpaSettingCard — success hint after QR decode pre-fills the VPA input" },
  { slug: "pay-qr-err-read", title: "Couldn't read a QR in that image.", description: "VpaSettingCard — QR decode failed (no QR found in image)" },
  { slug: "pay-qr-err-not-upi", title: "That doesn't look like a UPI QR.", description: "VpaSettingCard — decoded QR is not a upi:// URL" },
  { slug: "pay-qr-err-no-vpa", title: "Couldn't find a VPA in that QR — please type it instead.", description: "VpaSettingCard — upi:// URL has no pa= param" },
  { slug: "pay-qr-err-invalid", title: "That QR's VPA looks invalid — please type it instead.", description: "VpaSettingCard — pa= param fails VPA_RE shape check" },
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
        [s.title, s.description, "ui-upi-pay", rows[0].id]
      );
      updated++;
    } else {
      const id = cuid();
      await client.query(
        `INSERT INTO "Tab" (id, slug, title, description, category, is_default, is_custom, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, false, false, NOW(), NOW())`,
        [id, s.slug, s.title, s.description, "ui-upi-pay"]
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
  console.log("Seeding UPI intent-button UI string...");
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
