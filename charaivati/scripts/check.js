const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main(){
  console.log('Levels:');
  console.log(await prisma.level.findMany({ orderBy: { order: 'asc' } }));
  console.log('Sample Tabs:');
  console.log(await prisma.tab.findMany({ take: 20 }));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
