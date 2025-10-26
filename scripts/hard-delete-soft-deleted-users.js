// node scripts/hard-delete-soft-deleted-users.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const daysAfterSoftDelete = parseInt(process.env.SOFT_DELETE_RETENTION_DAYS ?? '30', 10);
  const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * daysAfterSoftDelete);
  console.log(`Hard-deleting users with deletionScheduledAt < ${cutoff.toISOString()}`);

  // Note: cascade deletes depend on your schema foreign key settings, otherwise you'll need to delete relations first.
  // You might prefer to archive rather than hard-delete.
  const deleted = await prisma.user.deleteMany({
    where: {
      status: 'deleted',
      deletionScheduledAt: { lt: cutoff }
    }
  });
  console.log(`Hard-deleted ${deleted.count} users`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
