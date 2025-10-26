// scripts/backfill-language-codes.js
// Node script to backfill Language.code column using Prisma client.
// Run with: node scripts/backfill-language-codes.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    // mapping for existing rows
    const map = { 1: "en", 2: "hi", 3: "as" };

    console.log("Fetching languages...");
    const langs = await prisma.language.findMany();

    console.log(`Found ${langs.length} language rows. Backfilling...`);
    for (const l of langs) {
      if (l.code && typeof l.code === "string" && l.code.trim().length > 0) {
        console.log(`Skipping id=${l.id} (already has code='${l.code}')`);
        continue;
      }
      const code = map[l.id] ?? (l.name ? l.name.toLowerCase().replace(/[^a-z]+/g, "").slice(0, 5) : String(l.id));
      await prisma.language.update({
        where: { id: l.id },
        data: { code },
      });
      console.log(`Updated id=${l.id} -> code='${code}'`);
    }

    console.log("Backfill complete.");
  } catch (err) {
    console.error("Error during backfill:", err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
