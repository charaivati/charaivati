// scripts/cleanup-empty-languages.js
// Run: node scripts/cleanup-empty-languages.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    // Find any languages with empty/null code or name
    const rows = await prisma.language.findMany({
      where: {
        OR: [
          { code: "" },
          { code: null },
          { name: "" },
          { name: null }
        ]
      }
    });

    if (rows.length === 0) {
      console.log("No empty language rows found.");
      return;
    }

    console.log("Found rows needing cleanup:", rows.map(r => ({ id: r.id, code: r.code, name: r.name })));

    // We'll assign sane defaults:
    // - If name is empty, set to 'Unknown'
    // - If code is empty, set to 'other' + id to keep uniqueness, e.g. 'other4'
    for (const r of rows) {
      const newName = (r.name && r.name.trim().length > 0) ? r.name : "Unknown";
      const newCode = (r.code && r.code.trim().length > 0) ? r.code : (`other${r.id}`);
      await prisma.language.update({
        where: { id: r.id },
        data: { name: newName, code: newCode },
      });
      console.log(`Updated id=${r.id} -> name='${newName}', code='${newCode}'`);
    }
    console.log("Cleanup complete.");
  } catch (e) {
    console.error("Error:", e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
