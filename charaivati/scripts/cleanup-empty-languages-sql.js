// scripts/cleanup-empty-languages-sql.js
// Run: node scripts/cleanup-empty-languages-sql.js
// This script uses raw SQL via prisma.$executeRawUnsafe so it doesn't depend on prisma client types.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Show current Language rows (before):");
    const before = await prisma.$queryRawUnsafe(`SELECT id, coalesce(code, '') as code, coalesce(name, '') as name FROM "Language" ORDER BY id;`);
    console.table(before);

    console.log("\nUpdating any rows where code IS NULL or empty to safe defaults...");
    // Update empty/null rows:
    // - If id 1/2/3 are your known languages, leave them alone;
    // - For any other row with empty code or name, set name='Unknown' and code='other<id>'
    await prisma.$executeRawUnsafe(`
      UPDATE "Language"
      SET
        name = CASE WHEN coalesce(name,'') = '' THEN 'Unknown' ELSE name END,
        code = CASE WHEN coalesce(code,'') = '' THEN concat('other', id::text) ELSE code END
      WHERE coalesce(code,'') = '' OR coalesce(name,'') = '';
    `);

    console.log("Update executed. Verifying result:");
    const after = await prisma.$queryRawUnsafe(`SELECT id, coalesce(code, '') as code, coalesce(name, '') as name FROM "Language" ORDER BY id;`);
    console.table(after);

    console.log("\nAll done. If you want Prisma types to be updated, run:");
    console.log("  npx prisma db pull");
    console.log("  npx prisma generate");
  } catch (e) {
    console.error("Error:", e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
