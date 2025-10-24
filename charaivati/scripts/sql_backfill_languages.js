// scripts/sql_backfill_languages.js
// Run with: node scripts/sql_backfill_languages.js
// This script uses Prisma's $executeRawUnsafe to run SQL statements directly.
// WARNING: This bypasses Prisma migrations. After running, sync schema with `npx prisma db pull` and `npx prisma generate`.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
  try {
    console.log("1) Adding nullable column 'code' if it doesn't exist...");

    // Add column if not exists (Postgres)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Language" ADD COLUMN IF NOT EXISTS "code" TEXT;
    `);
    console.log(" → Column ensured (nullable).");

    console.log("\n2) Backfilling codes (1->en, 2->hi, 3->as, fallback from name) ...");

    // Backfill with a single UPDATE CASE statement (fast)
    await prisma.$executeRawUnsafe(`
      UPDATE "Language"
      SET "code" = CASE
        WHEN id = 1 THEN 'en'
        WHEN id = 2 THEN 'hi'
        WHEN id = 3 THEN 'as'
        ELSE lower(regexp_replace(name, '[^A-Za-z]+', '', 'g'))
      END
      WHERE "code" IS NULL OR trim("code") = '';
    `);
    console.log(" → Backfill UPDATE executed.");

    // Verify how many rows remain NULL (just for info)
    const nullCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS cnt FROM "Language" WHERE "code" IS NULL OR trim("code") = '';`);
    console.log(" → rows still missing code:", nullCount?.[0]?.cnt ?? nullCount);

    console.log("\n3) Attempting to set NOT NULL constraint and add UNIQUE index...");

    // Attempt to set NOT NULL - this will fail if any NULL exists
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Language" ALTER COLUMN "code" SET NOT NULL;
      `);
      console.log(" → ALTER TABLE ... SET NOT NULL succeeded.");
    } catch (errNotNull) {
      console.warn(" ⚠️ Could not set NOT NULL (there may be NULLs). Error:", errNotNull.message || errNotNull);
      console.warn(" Skipping NOT NULL enforcement for now.");
    }

    // Create unique index if possible (if duplicates exist it will fail)
    try {
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "Language_code_key" ON "Language" ("code");
      `);
      console.log(" → Unique index created (or already existed).");
    } catch (errIdx) {
      console.warn(" ⚠️ Could not create unique index automatically. Error:", errIdx.message || errIdx);
      console.warn(" You may need to check duplicate codes before creating unique index.");
    }

    console.log("\nDone. Summary:");
    const sample = await prisma.$queryRawUnsafe(`SELECT id, code, name FROM "Language" ORDER BY id;`);
    console.table(sample);

    console.log("\nIMPORTANT NEXT STEPS (recommended):");
    console.log(" 1) Run: npx prisma db pull");
    console.log(" 2) Run: npx prisma generate");
    console.log(" 3) Restart your Next dev server (npm run dev)");
    console.log("These will sync your Prisma schema & generated client with the DB changes we just made.");

  } catch (e) {
    console.error("Fatal error during script:", e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
