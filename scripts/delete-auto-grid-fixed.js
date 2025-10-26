// scripts/delete-auto-grid-fixed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // 1) preview count (how many matched)
    const preview = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS cnt
      FROM "Tab"
      WHERE slug ~ '-r[0-9]+-c[0-9]+';
    `;
    console.log('Rows that will be deleted (preview):', preview[0]?.cnt ?? 0);

    if (!preview[0] || preview[0].cnt === 0) {
      console.log('Nothing to delete. Exiting.');
      return;
    }

    // Confirm with user prompt? (skip in script — run only when ready)
    // 2) Delete matched rows
    const res = await prisma.$executeRaw`
      DELETE FROM "Tab"
      WHERE slug ~ '-r[0-9]+-c[0-9]+';
    `;
    console.log('Delete executed. Result:', res);

  } catch (e) {
    console.error('ERROR during delete:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
