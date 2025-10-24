// scripts/cleanup-languages-safe.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function isBlank(s) {
  return s === null || s === undefined || (typeof s === "string" && s.trim().length === 0);
}

async function main() {
  try {
    // 1) load all languages (cheap table)
    const all = await prisma.language.findMany({
      select: { code: true, name: true, enabled: true }
    });

    // 2) find invalid rows in JS (robust to schema constraints)
    const invalid = all.filter(r => isBlank(r.code) || isBlank(r.name));

    console.log("Total languages found:", all.length);
    console.log("Invalid language rows (preview):", invalid.length);
    invalid.forEach(r => console.log(r));

    if (invalid.length === 0) {
      console.log("No invalid rows to remove. Exiting.");
      return;
    }

    // Safety: require env confirm
    if (process.env.CONFIRM_DELETE !== "1") {
      console.log("\nTo delete these rows run:");
      if (process.platform === "win32") {
        console.log('  PowerShell: $env:CONFIRM_DELETE="1"; node scripts/cleanup-languages-safe.js; Remove-Item Env:\\CONFIRM_DELETE');
      } else {
        console.log('  mac/linux: CONFIRM_DELETE=1 node scripts/cleanup-languages-safe.js');
      }
      return;
    }

    // 3) delete by code (safe)
    const codes = invalid.map(r => r.code).filter(Boolean);
    if (codes.length === 0) {
      console.log("No valid codes to delete (unexpected). Exiting.");
      return;
    }

    const del = await prisma.language.deleteMany({
      where: { code: { in: codes } }
    });

    console.log("Deleted rows result:", del);
  } catch (e) {
    console.error("ERROR:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
