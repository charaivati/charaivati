import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const locales = ["hi","bn","as","ta","te","mr","gu","kn","ml","pa","es","ru"];
  const total = await p.tab.count();
  console.log(`Total tabs: ${total}\n`);
  for (const locale of locales) {
    const n = await p.tabTranslation.count({ where: { locale } });
    const pct = Math.round((n / total) * 100);
    const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
    console.log(`  ${locale.padEnd(3)}  ${bar}  ${n}/${total} (${pct}%)`);
  }
}
main().catch(console.error).finally(() => p.$disconnect());
