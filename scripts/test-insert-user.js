// scripts/test-insert-user.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // create a test user
    const user = await prisma.user.create({
      data: {
        email: `user${Date.now()}@example.com`,
        passwordHash: null,
        verified: false,
        emailVerified: false,
      },
    });

    console.log("✅ Inserted user:", user);
  } catch (e) {
    console.error("❌ Error inserting user:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
