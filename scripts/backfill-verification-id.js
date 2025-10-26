// scripts/backfill-verification-id.js
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.verificationToken.findMany({
      where: { id: null },
      select: { token: true, identifier: true },
    });

    console.log('Rows to fill:', rows.length);

    for (const r of rows) {
      const newId = crypto.randomUUID(); // built-in, safe + unique
      await prisma.verificationToken.update({
        where: { token: r.token },
        data: { id: newId },
      });
      console.log('Updated token for', r.identifier, '->', newId);
    }

    console.log('Backfill done.');
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
