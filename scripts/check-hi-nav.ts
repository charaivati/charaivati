import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const navSlugs = ["self-personal","self-social","self-learn","self-earn","layer-self","layer-society-home","layer-nation-birth","layer-earth","layer-universe"];
  const rows = await p.tabTranslation.findMany({
    where: { locale: "hi", tab: { slug: { in: navSlugs } } },
    select: { locale: true, title: true, tab: { select: { slug: true } } },
  });
  console.log("Hindi nav translations in DB:", rows.length);
  rows.forEach(r => console.log(`  [${r.locale}] ${r.tab.slug} → "${r.title}"`));
  const total = await p.tabTranslation.count();
  console.log("Total TabTranslation rows:", total);
}
main().catch(console.error).finally(() => p.$disconnect());
