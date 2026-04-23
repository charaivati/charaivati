// scripts/seed-ui-tabs.ts
// Upserts the UI string Tabs used in the Sahayak page into the Tab table.
// These were previously hardcoded in UI_TRANSLATIONS — adding them to the DB
// lets them be translated via the normal tab-translation system.
// Run with: npx tsx scripts/seed-ui-tabs.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const UI_TABS = [
  { slug: "ui-video-tutorials",  title: "Video Tutorials",            description: "Section heading for video tutorial content" },
  { slug: "ui-official-links",   title: "Official Links",             description: "Section heading for official government/service links" },
  { slug: "ui-loading-videos",   title: "Loading videos…",       description: "Loading state text for videos" },
  { slug: "ui-no-videos",        title: "No videos available",        description: "Empty state text when no videos exist for a section" },
  { slug: "ui-loading-links",    title: "Loading links…",        description: "Loading state text for help links" },
  { slug: "ui-no-links",         title: "No official links configured", description: "Empty state text when no links exist for a section" },
  { slug: "ui-choose-language",  title: "Choose Language",            description: "Button label for the language picker" },
];

async function main() {
  console.log("Seeding UI string Tabs...\n");

  for (const tab of UI_TABS) {
    const existing = await prisma.tab.findUnique({ where: { slug: tab.slug } });
    if (existing) {
      await prisma.tab.update({
        where: { id: existing.id },
        data: { title: tab.title, description: tab.description, category: "ui" },
      });
      console.log(`  ✓ Updated  ${tab.slug}`);
    } else {
      await prisma.tab.create({
        data: {
          slug: tab.slug,
          title: tab.title,
          description: tab.description,
          category: "ui",
          is_default: false,
          is_custom: false,
        },
      });
      console.log(`  + Created  ${tab.slug}  "${tab.title}"`);
    }
  }

  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
