// Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/migrateStoreSlugs.ts
import { PrismaClient } from "@prisma/client";
import { generateSlug } from "../lib/store/generateSlug";

const prisma = new PrismaClient();

async function main() {
  // Fetch all stores where slug IS NULL via raw SQL (client may not know slug field)
  const stores = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM "Store" WHERE slug IS NULL ORDER BY "createdAt" ASC
  `;

  console.log(`Found ${stores.length} store(s) with no slug.`);

  let updated = 0;

  for (const store of stores) {
    let candidate = generateSlug(store.name);
    if (!candidate) candidate = store.id.slice(-8);

    // Check for conflict
    const conflicts = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Store" WHERE slug = ${candidate} LIMIT 1
    `;

    let slug = candidate;
    if (conflicts.length > 0) {
      slug = `${candidate}-${store.id.slice(0, 4)}`;

      // If that also conflicts (extremely unlikely), append more of the id
      const conflicts2 = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Store" WHERE slug = ${slug} LIMIT 1
      `;
      if (conflicts2.length > 0) {
        slug = `${candidate}-${store.id.slice(0, 8)}`;
      }
    }

    await prisma.$executeRaw`UPDATE "Store" SET slug = ${slug} WHERE id = ${store.id}`;
    console.log(`  Store "${store.name}" → slug: "${slug}"`);
    updated++;
  }

  console.log(`\nDone. ${updated} store(s) updated.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
