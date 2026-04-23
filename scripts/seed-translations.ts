// scripts/seed-translations.ts
// Auto-translates every Tab into every enabled Language using the existing
// callAI infrastructure (Ollama → OpenRouter → Gemini fallback chain).
//
// Run with:  npx tsx scripts/seed-translations.ts
//
// Options (env vars):
//   TRANSLATE_LOCALE=hi   — only translate for one locale
//   TRANSLATE_SLUG=epfo   — only translate one tab
//   DRY_RUN=1             — print prompts without calling AI or DB

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { callAI } from "../app/api/aiClient";

const prisma = new PrismaClient();

const DELAY_MS   = 200;
const DRY_RUN    = process.env.DRY_RUN === "1";
const ONLY_LOCALE = process.env.TRANSLATE_LOCALE ?? null;
const ONLY_SLUG   = process.env.TRANSLATE_SLUG   ?? null;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function translate(text: string, langName: string, nativeName: string): Promise<string> {
  const systemPrompt = "You are a professional translator. Return ONLY the translated text with no explanation, no quotes, no extra punctuation.";
  const prompt       = `Translate the following UI text to ${langName} (${nativeName}). Return only the translated text, nothing else.\n\n"${text}"`;

  const raw = await callAI({ prompt, systemPrompt, maxTokens: 200 });
  // Strip surrounding quotes the model may add
  return raw.trim().replace(/^["']|["']$/g, "").trim();
}

async function main() {
  console.log(`\n=== seed-translations${DRY_RUN ? " [DRY RUN]" : ""} ===\n`);

  const [tabs, languages] = await Promise.all([
    prisma.tab.findMany({
      orderBy: { slug: "asc" },
      ...(ONLY_SLUG ? { where: { slug: ONLY_SLUG } } : {}),
    }),
    prisma.language.findMany({
      where: {
        enabled: true,
        ...(ONLY_LOCALE ? { code: ONLY_LOCALE } : {}),
      },
      orderBy: { id: "asc" },
    }),
  ]);

  console.log(`Tabs: ${tabs.length}   Languages: ${languages.length}\n`);

  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const tab of tabs) {
    for (const lang of languages) {
      if (!lang.code) {
        console.warn(`  ⚠ Language "${lang.name}" has no code — skipping`);
        continue;
      }

      const existingTitle = await prisma.tabTranslation.findUnique({
        where: { tabId_locale: { tabId: tab.id, locale: lang.code } },
        select: { autoTranslated: true, title: true },
      });

      // Skip if a human-provided translation already exists
      if (existingTitle && !existingTitle.autoTranslated) {
        console.log(`  ⟳ Skip  [${lang.code}] ${tab.slug}  (human translation exists)`);
        skipped++;
        continue;
      }

      const titleToTranslate = tab.title?.trim();
      if (!titleToTranslate) {
        console.log(`  ⟳ Skip  [${lang.code}] ${tab.slug}  (empty English title)`);
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  ~ DRY   [${lang.code}] "${titleToTranslate}" → ${lang.nativeName ?? lang.name}`);
        continue;
      }

      try {
        const translatedTitle = await translate(titleToTranslate, lang.name, lang.nativeName ?? lang.name);

        let translatedDescription: string | undefined;
        if (tab.description?.trim()) {
          translatedDescription = await translate(tab.description, lang.name, lang.nativeName ?? lang.name);
        }

        await prisma.tabTranslation.upsert({
          where: { tabId_locale: { tabId: tab.id, locale: lang.code } },
          create: {
            tabId:          tab.id,
            locale:         lang.code,
            title:          translatedTitle,
            description:    translatedDescription ?? null,
            autoTranslated: true,
            status:         "published",
          },
          update: {
            title:          translatedTitle,
            description:    translatedDescription ?? null,
            autoTranslated: true,
            status:         "published",
          },
        });

        console.log(`  ✓  [${lang.code}] ${tab.slug}  →  "${translatedTitle}"`);
        done++;
      } catch (err: any) {
        console.error(`  ✗  [${lang.code}] ${tab.slug}  →  ${err.message ?? err}`);
        failed++;
      }

      await delay(DELAY_MS);
    }
  }

  console.log(`\n=== Done: ${done} translated, ${skipped} skipped, ${failed} failed ===\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
