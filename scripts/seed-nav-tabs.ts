// scripts/seed-nav-tabs.ts
// Creates Tab DB records for every nav tab label defined in LayerContext.
// Slug = the tab id (e.g. "self-personal"). This lets seed-translations.ts
// auto-translate them and HeaderTabs fetch them via /api/tab-translations.
// Run with: npx tsx scripts/seed-nav-tabs.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const NAV_TABS = [
  // Layer labels
  { slug: "layer-self",         title: "Self",                        description: "Personal layer" },
  { slug: "layer-society-home", title: "Society",                     description: "Local & State layer" },
  { slug: "layer-nation-birth", title: "Nation",                      description: "Country-wide layer" },
  { slug: "layer-earth",        title: "Earth",                       description: "Global layer" },
  { slug: "layer-universe",     title: "Universe",                    description: "Beyond layer" },

  // Self tabs
  { slug: "self-personal",      title: "Personal",                    description: "Personal tab" },
  { slug: "self-social",        title: "Social",                      description: "Friends & social tab" },
  { slug: "self-learn",         title: "Learn",                       description: "Learning tab" },
  { slug: "self-earn",          title: "Earn",                        description: "Earning tab" },

  // Society tabs
  { slug: "soc-panchayat",      title: "Panchayat/Ward",              description: "Panchayat or Ward tab" },
  { slug: "soc-legislative",    title: "Legislative constituency",    description: "Legislative constituency tab" },
  { slug: "soc-parliamentary",  title: "Parliamentary constituency",  description: "Parliamentary constituency tab" },
  { slug: "soc-state",          title: "State",                       description: "State tab" },

  // Nation tabs
  { slug: "nat-legislature",    title: "Legislature",                 description: "Legislature tab" },
  { slug: "nat-executive",      title: "Executive",                   description: "Executive tab" },
  { slug: "nat-judiciary",      title: "Judiciary",                   description: "Judiciary tab" },
  { slug: "nat-media",          title: "Media",                       description: "Media tab" },

  // Earth tabs
  { slug: "earth-worldview",    title: "World View",                  description: "World View tab" },
  { slug: "earth-humanstories", title: "Human stories",               description: "Human stories tab" },
  { slug: "earth-collab",       title: "Collaborate / Act Now",       description: "Collaborate tab" },
  { slug: "earth-knowledge",    title: "Knowledge / Tools",           description: "Knowledge tab" },

  // Universe tabs
  { slug: "uni-spirit",         title: "Spirituality",                description: "Spirituality tab" },
  { slug: "uni-science",        title: "Science",                     description: "Science tab" },
  { slug: "uni-ideas",          title: "Ideas",                       description: "Ideas tab" },
  { slug: "uni-other",          title: "Other",                       description: "Other tab" },
];

async function main() {
  console.log("Seeding nav tab records...\n");
  for (const tab of NAV_TABS) {
    const existing = await prisma.tab.findUnique({ where: { slug: tab.slug } });
    if (existing) {
      await prisma.tab.update({
        where: { id: existing.id },
        data: { title: tab.title, description: tab.description, category: "nav" },
      });
      console.log(`  ✓ Updated  ${tab.slug}`);
    } else {
      await prisma.tab.create({
        data: { slug: tab.slug, title: tab.title, description: tab.description, category: "nav", is_default: false, is_custom: false },
      });
      console.log(`  + Created  ${tab.slug}  "${tab.title}"`);
    }
  }
  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
