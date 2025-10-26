// scripts/list_tables.js
const { PrismaClient } = require("@prisma/client");

(async () => {
  const prisma = new PrismaClient();
  try {
    const res = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`;
    console.log("Public tables:");
    console.log(res);
  } catch (e) {
    console.error("ERROR running query:", e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
