// scripts/db-checks.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  const total = await prisma.tab.count();
  console.log('Total tabs:', total);

  const perLevel = await prisma.tab.groupBy({
    by: ['levelId'],
    _count: { _all: true },
  });
  console.log('Tabs per levelId:', perLevel);

  // show top 20 newest tabs (quick sample)
  const sample = await prisma.tab.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
  console.log('Latest 20 tabs (sample):', sample.map(t => ({ id: t.id, slug: t.slug, title: t.title, levelId: t.levelId, createdAt: t.createdAt })));

  // list duplicate slugs (slug count >1)
  const duplicates = await prisma.$queryRawUnsafe(`
    SELECT slug, COUNT(*) as cnt
    FROM "Tab"
    GROUP BY slug
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 100
  `);
  console.log('Duplicate slugs (top 100):', duplicates);

  await prisma.$disconnect();
}
main().catch(e => {
  console.error('ERROR', e);
  process.exit(1);
});
