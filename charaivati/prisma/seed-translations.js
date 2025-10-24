// prisma/seed-translations.js
// Usage:
//   LIBRE_TRANSLATE_URL=https://libretranslate.com node prisma/seed-translations.js
// or just: node prisma/seed-translations.js   (creates hi rows as English placeholders, autoTranslated=true)

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const LIBRE_URL = process.env.LIBRE_TRANSLATE_URL || null;
// optional API key for LibreTranslate (some instances require it)
const LIBRE_KEY = process.env.LIBRE_TRANSLATE_KEY || null;

/**
 * Translate text using LibreTranslate (if configured).
 * Returns original text if translation fails.
 */
async function translateLibre(text, source = "en", target = "hi") {
  if (!LIBRE_URL) return null;
  try {
    const body = {
      q: text,
      source,
      target,
      format: "text",
    };
    if (LIBRE_KEY) body.api_key = LIBRE_KEY;
    const res = await fetch(`${LIBRE_URL}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    // libretranslate returns { translatedText: "..."}
    if (json && json.translatedText) return json.translatedText;
    // some deployments return { result: "..." }
    if (json && json.result) return json.result;
    return null;
  } catch (e) {
    console.warn("Libre translate failed:", e?.message ?? e);
    return null;
  }
}

async function main() {
  console.log("Seeding Hindi translations for Tabs...");

  // load all tabs and their English translation if present
  const tabs = await prisma.tab.findMany({
    select: { id: true, title: true, description: true, slug: true },
  });

  console.log("Tabs found:", tabs.length);
  let created = 0, updated = 0, skipped = 0;

  for (const t of tabs) {
    // check if hi translation exists
    const existing = await prisma.tabTranslation.findUnique({
      where: { tabId_locale: { tabId: t.id, locale: "hi" } },
    });

    // generate translation text (try libre if configured)
    let translatedTitle = null;
    let translatedDesc = null;
    if (LIBRE_URL) {
      translatedTitle = await translateLibre(t.title, "en", "hi");
      // translate description only if present
      if (t.description) translatedDesc = await translateLibre(t.description, "en", "hi");
    }

    // fallback: copy English (mark autoTranslated=true so you can find & review later)
    if (!translatedTitle) translatedTitle = t.title;
    if (!translatedDesc) translatedDesc = t.description ?? null;

    const payload = {
      tabId: t.id,
      locale: "hi",
      title: translatedTitle,
      description: translatedDesc,
      slug: t.slug, // keep same slug; you may want localized slugs later
      autoTranslated: LIBRE_URL ? true : true, // true either way to indicate review likely necessary
      status: "needs_review", // set to needs_review by default
    };

    if (existing) {
      // update if content differs
      await prisma.tabTranslation.update({
        where: { tabId_locale: { tabId: t.id, locale: "hi" } },
        data: {
          title: payload.title,
          description: payload.description,
          slug: payload.slug,
          autoTranslated: payload.autoTranslated,
          status: payload.status,
          updatedAt: new Date(),
        },
      });
      updated++;
    } else {
      await prisma.tabTranslation.create({ data: payload });
      created++;
    }
  }

  console.log(`Done. created=${created}, updated=${updated}, skipped=${skipped}`);
}

main()
  .catch((e) => {
    console.error("ERROR", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
