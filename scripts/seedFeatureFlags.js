// scripts/seedFeatureFlags.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.featureFlag.createMany({
    data: [
      { key: "layer.self", enabled: true },
      { key: "layer.society", enabled: false },
      { key: "layer.nation", enabled: false },
      { key: "layer.earth", enabled: false },
      { key: "layer.universe", enabled: false },
    ],
    skipDuplicates: true,
  });
  console.log("✅ Feature flags seeded");
}

main()
  .catch((e) => {
    console.error("❌ Seeder error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
