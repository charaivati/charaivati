// scripts/seed-hi-nav-quick.ts
// Quick targeted seed: translates nav + ui tab labels to Hindi only.
// Skips any tab that already has a Hindi translation.
// Run with: npx tsx scripts/seed-hi-nav-quick.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { callAI } from "../app/api/aiClient";

const prisma = new PrismaClient();

const NAV_SLUGS = [
  "layer-self","layer-society-home","layer-nation-birth","layer-earth","layer-universe",
  "self-personal","self-social","self-learn","self-earn",
  "soc-panchayat","soc-legislative","soc-parliamentary","soc-state",
  "nat-legislature","nat-executive","nat-judiciary","nat-media",
  "earth-worldview","earth-humanstories","earth-collab","earth-knowledge",
  "uni-spirit","uni-science","uni-ideas","uni-other",
  "ui-video-tutorials","ui-official-links","ui-loading-videos","ui-no-videos",
  "ui-loading-links","ui-no-links","ui-choose-language",
];

async function translate(text: string): Promise<string> {
  const raw = await callAI({
    prompt: `Translate this UI label to Hindi. Return ONLY the translated text, nothing else.\n\n"${text}"`,
    systemPrompt: "You are a professional translator. Return ONLY the translated text.",
    maxTokens: 100,
  });
  return raw.trim().replace(/^["']|["']$/g, "").trim();
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  console.log("Quick Hindi nav seed...\n");

  const tabs = await prisma.tab.findMany({
    where: { slug: { in: NAV_SLUGS } },
    orderBy: { slug: "asc" },
  });

  let done = 0, skipped = 0;

  for (const tab of tabs) {
    const existing = await prisma.tabTranslation.findUnique({
      where: { tabId_locale: { tabId: tab.id, locale: "hi" } },
    });
    if (existing) { console.log(`  ⟳ Skip  ${tab.slug}  (already exists)`); skipped++; continue; }

    try {
      const title = await translate(tab.title);
      const description = tab.description ? await translate(tab.description) : null;

      await prisma.tabTranslation.create({
        data: { tabId: tab.id, locale: "hi", title, description, autoTranslated: true, status: "published" },
      });
      console.log(`  ✓  ${tab.slug}  →  "${title}"`);
      done++;
    } catch (e: any) {
      console.error(`  ✗  ${tab.slug}  ${e.message}`);
    }
    await delay(200);
  }

  console.log(`\nDone: ${done} translated, ${skipped} skipped`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
