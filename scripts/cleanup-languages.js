// scripts/cleanup-languages.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    // preview
    const preview = await prisma.$queryRaw`SELECT id, code, name FROM "Language" WHERE code IS NULL OR name IS NULL OR trim(code) = '' OR trim(name) = '';`;
    console.log("Bad rows preview:", preview);

    if (preview.length === 0) {
      console.log("No invalid language rows found.");
      return;
    }

    // delete
    const res = await prisma.$executeRaw`DELETE FROM "Language" WHERE code IS NULL OR name IS NULL OR trim(code) = '' OR trim(name) = '';`;
    console.log("Deleted rows result:", res);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
