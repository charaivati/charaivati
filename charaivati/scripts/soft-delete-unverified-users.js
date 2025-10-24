// node scripts/soft-delete-unverified-users.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const days = parseInt(process.env.UNVERIFIED_GRACE_DAYS ?? '30', 10);
  const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * days);
  console.log(`Soft-deleting users created before ${cutoff.toISOString()} with emailVerified=false`);

  // Find candidate users (log them for review)
  const candidates = await prisma.user.findMany({
    where: {
      emailVerified: false,
      createdAt: { lt: cutoff },
      // skip already-deleted users if you already have a status field
      NOT: [{ status: 'deleted' }]
    },
    select: { id: true, email: true, name: true, createdAt: true }
  });

  console.log(`Found ${candidates.length} unverified users to soft-delete (sample):`);
  console.log(candidates.slice(0, 20));

  if (candidates.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  // Soft-delete: update status/deletionScheduledAt (you can also set deletedAt)
  const ids = candidates.map(u => u.id);
  const result = await prisma.user.updateMany({
    where: { id: { in: ids } },
    data: {
      status: 'deleted',
      deletionScheduledAt: new Date()
    }
  });

  console.log(`Updated ${result.count} users -> status=deleted`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
