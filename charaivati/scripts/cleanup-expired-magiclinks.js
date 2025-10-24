// node scripts/cleanup-expired-magiclinks.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting cleanup of old magic links...');
  const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30); // 30 days
  const deleted = await prisma.magicLink.deleteMany({
    where: {
      OR: [
        { used: true, usedAt: { lt: cutoff } },
        { expiresAt: { lt: cutoff } }
      ]
    }
  });
  console.log(`Deleted ${deleted.count} old magicLink rows older than ${cutoff.toISOString()}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
