// scripts/preview-auto-grid-fixed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // counts per level for slugs matching the auto-grid pattern
    const rows = await prisma.$queryRaw`
      SELECT "levelId", COUNT(*) AS cnt
      FROM "Tab"
      WHERE slug ~ '-r[0-9]+-c[0-9]+'
      GROUP BY "levelId"
      ORDER BY "levelId";
    `;
    console.log('Auto-grid counts by levelId:', rows);

    // sample rows whose slug contains r1-c1 (a representative sample)
    const sample = await prisma.tab.findMany({
      where: { slug: { contains: '-r1-c1' } },
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    console.log('Sample rows (r1-c1 pattern):', sample.map(s => ({ id: s.id, slug: s.slug, title: s.title, createdAt: s.createdAt })));
  } catch (e) {
    console.error('ERROR in preview:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
