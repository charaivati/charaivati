// prisma/seed-health-system.js
// Upserts the Charaivati Health system page + health business.
// Safe to run multiple times. Run with: node prisma/seed-health-system.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.page.upsert({
    where: { id: "charaivati-health" },
    update: {},
    create: {
      id: "charaivati-health",
      title: "Charaivati Health",
      description: "AI-powered health suggestions personalized to your current state",
      type: "health",
      status: "active",
      ownerId: null,
      viewCount: 9999,
    },
  });
  console.log("✓ Charaivati Health page upserted");

  await prisma.healthBusiness.upsert({
    where: { pageId: "charaivati-health" },
    update: {},
    create: {
      pageId: "charaivati-health",
      specialty: "holistic",
      credentials: "AI-powered · Free for all users",
      consultationMode: "agent",
      searchTags: ["nutrition", "fitness", "sleep", "mental", "weight-loss", "holistic"],
    },
  });
  console.log("✓ Charaivati Health business upserted");
}

main()
  .catch((e) => {
    console.error("SEED ERROR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
